"""
backend/ai/model_config.py
==========================
Configuration for local-first LLM gateway and hybrid RAG models.
"""

import os
from typing import List

# Ollama local settings
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
ROUTER_MODEL: str = os.getenv("ROUTER_MODEL", "qwen2.5:3b")
GENERATOR_MODEL: str = os.getenv("GENERATOR_MODEL", "qwen2.5:7b-instruct")

# Retrieval & Reranker models
EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
RERANKER_MODEL_NAME: str = os.getenv("RERANKER_MODEL_NAME", "cross-encoder/ms-marco-MiniLM-L-6-v2")

# Operational timeouts & thresholds
OLLAMA_TIMEOUT: float = float(os.getenv("OLLAMA_TIMEOUT", "20.0"))
RELEVANCE_THRESHOLD: float = float(os.getenv("RELEVANCE_THRESHOLD", "0.20"))
TOP_K_RETRIEVAL: int = int(os.getenv("TOP_K_RETRIEVAL", "5"))

VALID_INTENTS: List[str] = [
    "career_comparison",
    "readiness_check",
    "roadmap_help",
    "resume_analysis",
    "general_role_info",
]
