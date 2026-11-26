"""
backend/ai/rag/indexer.py
=========================
Builds and caches the hybrid index (Dense Semantic Vector Index + Sparse BM25 Index).
"""

from __future__ import annotations

import logging
import re
from typing import List, Optional, Tuple

import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

from backend.ai.model_config import EMBEDDING_MODEL_NAME
from backend.ai.rag.chunking import RAGChunk, load_curated_rag_corpus

logger = logging.getLogger(__name__)


def _tokenize(text: str) -> List[str]:
    """Tokenize query or document for BM25 with preservation of tech acronyms and symbols."""
    clean = re.sub(r"[^\w\+\#\.\-]", " ", text.lower())
    return [w for w in clean.split() if len(w) > 1]


class HybridIndex:
    """In-memory hybrid search index combining SentenceTransformers and BM25."""

    def __init__(self, chunks: List[RAGChunk], model_name: str = EMBEDDING_MODEL_NAME) -> None:
        self.chunks = chunks
        self.model_name = model_name
        self.encoder: Optional[SentenceTransformer] = None
        self.embeddings: Optional[np.ndarray] = None
        self.bm25: Optional[BM25Okapi] = None
        self._build()

    def _build(self) -> None:
        logger.info(f"Building Hybrid Index over {len(self.chunks)} curated chunks...")

        # 1. Build BM25 index
        corpus_tokens = [_tokenize(c.text) for c in self.chunks]
        self.bm25 = BM25Okapi(corpus_tokens)

        # 2. Build Dense Embeddings
        try:
            self.encoder = SentenceTransformer(self.model_name)
            texts = [c.text for c in self.chunks]
            embs = self.encoder.encode(texts, show_progress_bar=False, normalize_embeddings=True)
            self.embeddings = np.array(embs, dtype=np.float32)
            logger.info("Hybrid Index successfully built.")
        except Exception as e:
            logger.warning(f"Dense encoder failed to initialize ({e}). Operating in BM25-fallback mode.")
            self.embeddings = None


_GLOBAL_INDEX: Optional[HybridIndex] = None


def get_hybrid_index() -> HybridIndex:
    """Singleton accessor for the pre-built hybrid index."""
    global _GLOBAL_INDEX
    if _GLOBAL_INDEX is None:
        chunks = load_curated_rag_corpus()
        _GLOBAL_INDEX = HybridIndex(chunks)
    return _GLOBAL_INDEX
