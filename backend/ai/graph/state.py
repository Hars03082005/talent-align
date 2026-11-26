"""
backend/ai/graph/state.py
=========================
Typed state schema for LangGraph career intelligence workflow.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict


class AgentState(TypedDict):
    query: str
    user_id: Optional[str]
    session_id: Optional[str]
    role_id: Optional[str]
    intent: Optional[str]
    active_agent: Optional[str]
    ml_context: Dict[str, Any]
    rag_chunks: List[Dict[str, Any]]
    tools_used: List[str]
    citations: List[str]
    draft_response: Optional[str]
    final_response: Optional[str]
    validation_passed: bool
    violations: List[str]
    retry_count: int
