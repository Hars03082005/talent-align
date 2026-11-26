"""
backend/ai/rag/retriever.py
===========================
Hybrid retrieval engine combining BM25 keyword matching with Dense Semantic Search,
Cross-Encoder reranking, and a strict relevance threshold.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from backend.ai.model_config import (
    RELEVANCE_THRESHOLD,
    RERANKER_MODEL_NAME,
    TOP_K_RETRIEVAL,
)
from backend.ai.rag.indexer import _tokenize, get_hybrid_index

logger = logging.getLogger(__name__)

_RERANKER = None
_RERANKER_LOADED = False


def _get_cross_encoder():
    """Lazily load the cross-encoder reranker if available."""
    global _RERANKER, _RERANKER_LOADED
    if not _RERANKER_LOADED:
        _RERANKER_LOADED = True
        try:
            from sentence_transformers import CrossEncoder

            _RERANKER = CrossEncoder(RERANKER_MODEL_NAME)
            logger.info(f"Loaded Cross-Encoder reranker: {RERANKER_MODEL_NAME}")
        except Exception as e:
            logger.info(f"Cross-Encoder not loaded ({e}). Using normalized hybrid fusion.")
            _RERANKER = None
    return _RERANKER


def retrieve_chunks(
    query: str,
    top_k: int = TOP_K_RETRIEVAL,
    threshold: float = RELEVANCE_THRESHOLD,
    role_id_filter: Optional[str] = None,
    role_id: Optional[str] = None,
    section: Optional[str] = None,
    source: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Perform hybrid retrieval:
      1. BM25 scoring for exact keyword match.
      2. Dense cosine similarity for semantic match.
      3. Reciprocal Rank Fusion / Weighted combination.
      4. Metadata filtering by role_id, section, and source.
      5. Cross-Encoder reranking (if available).
      6. Relevance threshold check with clean abstention.
    """
    index = get_hybrid_index()
    chunks = index.chunks
    num_chunks = len(chunks)

    if num_chunks == 0:
        return {"chunks": [], "weak_evidence": True, "top_score": 0.0, "abstain_message": "Knowledge corpus is empty."}

    # 1. BM25 Lexical Scores
    query_tokens = _tokenize(query)
    bm25_scores = np.array(index.bm25.get_scores(query_tokens)) if index.bm25 else np.zeros(num_chunks)
    max_bm25 = float(np.max(bm25_scores)) if len(bm25_scores) > 0 else 0.0
    norm_bm25 = (bm25_scores / (max_bm25 + 1e-9)) if max_bm25 > 0 else np.zeros(num_chunks)

    # 2. Dense Semantic Scores
    dense_scores = np.zeros(num_chunks)
    if index.encoder is not None and index.embeddings is not None:
        try:
            q_emb = index.encoder.encode([query], normalize_embeddings=True)[0]
            dense_scores = np.dot(index.embeddings, q_emb)
        except Exception as e:
            logger.warning(f"Dense retrieval error: {e}")

    # 3. Hybrid Fusion Score
    weight_dense = 0.55 if max_bm25 > 0 else 1.0
    weight_bm25 = 0.45 if max_bm25 > 0 else 0.0
    hybrid_scores = (weight_dense * dense_scores) + (weight_bm25 * norm_bm25)

    # 4. Metadata Filtering (role_id, section, source)
    target_role_id = role_id or role_id_filter
    valid_indices = []
    for i, c in enumerate(chunks):
        if target_role_id and c.role_id != target_role_id:
            continue
        if section and c.section != section:
            continue
        if source and c.source != source:
            continue
        valid_indices.append(i)

    if not valid_indices:
        # If strict metadata filter eliminated all candidates, return empty with clean abstention
        return {
            "chunks": [],
            "weak_evidence": True,
            "top_score": 0.0,
            "abstain_message": f"No knowledge chunks match filter (role_id={target_role_id}, section={section}, source={source}).",
        }

    # Restrict scores to valid metadata indices
    filtered_scores = [(hybrid_scores[i], i) for i in valid_indices]
    filtered_scores.sort(key=lambda x: x[0], reverse=True)
    candidate_indices = [idx for score, idx in filtered_scores[: max(15, top_k * 2)] if score > 0.0]

    if not candidate_indices:
        return {"chunks": [], "weak_evidence": True, "top_score": 0.0, "abstain_message": "No relevant evidence found above threshold."}

    # 4. Cross-Encoder Reranking
    reranker = _get_cross_encoder()
    final_scored: List[Tuple[float, int]] = []

    if reranker is not None:
        try:
            pairs = [[query, chunks[idx].text] for idx in candidate_indices]
            ce_scores = reranker.predict(pairs)
            for idx, score in zip(candidate_indices, ce_scores):
                # Sigmoid normalization if logits
                prob = 1.0 / (1.0 + np.exp(-float(score)))
                final_scored.append((prob, idx))
            final_scored.sort(key=lambda x: x[0], reverse=True)
        except Exception as e:
            logger.warning(f"Reranking error: {e}")
            final_scored = [(float(hybrid_scores[idx]), idx) for idx in candidate_indices]
    else:
        final_scored = [(float(hybrid_scores[idx]), idx) for idx in candidate_indices]

    top_candidates = final_scored[:top_k]
    top_score = top_candidates[0][0] if top_candidates else 0.0

    # 5a. Cross-encoder fallback: if CE scores are very low but BM25 had strong hits,
    # fall back to pure hybrid (BM25+dense) scores within valid_indices to preserve metadata filters
    if reranker is not None and top_score < threshold:
        bm25_top_indices = [idx for _, idx in filtered_scores[:top_k]]
        if bm25_top_indices:
            bm25_top_score = float(filtered_scores[0][0])
            if bm25_top_score >= threshold:
                # Cross-encoder suppressed a valid BM25 hit — use hybrid scores from filtered candidates
                logger.info(
                    f"Cross-encoder fallback: CE top_score={top_score:.4f} < threshold, "
                    f"but filtered hybrid top={bm25_top_score:.4f}. Using filtered hybrid scores."
                )
                top_candidates = [(float(score), idx) for score, idx in filtered_scores[:top_k]]
                top_score = bm25_top_score

    # 5b. Strict Relevance Thresholding
    if top_score < threshold:
        return {
            "chunks": [],
            "weak_evidence": True,
            "top_score": float(top_score),
            "threshold": threshold,
        }

    results = []
    for score, idx in top_candidates:
        c = chunks[idx]
        item = c.to_dict()
        item["score"] = round(float(score), 4)
        results.append(item)

    return {
        "chunks": results,
        "weak_evidence": False,
        "top_score": float(top_score),
    }
