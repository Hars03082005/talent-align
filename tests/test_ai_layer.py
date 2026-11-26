"""
tests/test_ai_layer.py
======================
Unit and integration tests for the AI Layer:
  1. Hybrid RAG retrieval (top-k=5, metadata structure)
  2. BM25 exact keyword matching for specialized technical terms
  3. Weak evidence threshold abstaining on irrelevant queries
  4. Intent classification routing and fallback
  5. Resume parsing and canonical skill normalization
  6. Python validator catching hallucinated bps / numbers
  7. Python validator catching hallucinated role names
  8. Python validator passing valid grounded metrics
  9. End-to-end /ai/chat and /ai/resume API endpoints
"""

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.ai.agents.resume_agent import (
    ExtractedResumeData,
    SkillNormalizer,
    _heuristic_resume_fallback,
)
from backend.ai.llm_router import classify_intent, rule_based_intent_fallback
from backend.ai.rag.chunking import load_curated_rag_corpus
from backend.ai.rag.retriever import retrieve_chunks
from backend.ai.validator import validate_ai_response
from backend.main import app

client = TestClient(app)


# ── 1. Hybrid RAG Tests ───────────────────────────────────────────────────────

def test_rag_corpus_indexing():
    """Verify curated chunks are loaded only from approved sources (no raw CSVs)."""
    chunks = load_curated_rag_corpus()
    assert len(chunks) > 50, "Expected at least 50 curated chunks"
    allowed_sources = {"emerging_roles.json", "role_explanations.json", "roadmap_curriculum", "job_listings"}
    for c in chunks:
        assert c.source in allowed_sources, f"Forbidden source indexed: {c.source}"
        assert c.role_name, "Chunk missing role_name"
        assert c.section, "Chunk missing section"


def test_rag_hybrid_retrieval_top_k():
    """Verify top-5 chunks are retrieved with valid scores."""
    res = retrieve_chunks("What are the core technical requirements for Cloud Architect?", top_k=5)
    assert not res["weak_evidence"]
    chunks = res["chunks"]
    assert len(chunks) <= 5
    assert len(chunks) > 0
    assert any("cloud" in c["role_name"].lower() for c in chunks)
    for c in chunks:
        assert "score" in c
        assert c["score"] >= 0.0


def test_rag_bm25_exact_tech_keywords():
    """Verify BM25 keyword matching for exact technical terms."""
    res = retrieve_chunks("LangGraph and RAG pipeline engineering", top_k=5)
    assert not res["weak_evidence"]
    assert len(res["chunks"]) > 0


def test_rag_weak_evidence_threshold():
    """Verify retriever flags weak evidence and abstains on totally irrelevant query."""
    # Use a high threshold (0.60) to ensure food-related query gets no career corpus hits
    res = retrieve_chunks("How to bake sourdough bread with yeast and flour", top_k=5, threshold=0.60)
    assert res["weak_evidence"] is True or len(res["chunks"]) == 0


# ── 2. Intent Routing Tests ───────────────────────────────────────────────────

def test_intent_rule_based_fallback():
    """Verify deterministic fallback intent classifier."""
    assert rule_based_intent_fallback("Compare MLOps vs Data Engineer") == "career_comparison"
    assert rule_based_intent_fallback("Am I ready for a Senior Architect role?") == "readiness_check"
    assert rule_based_intent_fallback("What is the learning roadmap for AI Engineer?") == "roadmap_help"
    assert rule_based_intent_fallback("Can you review my resume and extract skills?") == "resume_analysis"
    assert rule_based_intent_fallback("Tell me about the demand for Cloud Engineer") == "general_role_info"


def test_intent_classifier_with_mocked_ollama():
    """Verify classify_intent parses JSON correctly when Ollama returns structured JSON."""
    mock_json = '{"intent": "career_comparison", "confidence": 0.98}'
    with patch("backend.ai.llm_router._call_ollama", return_value=mock_json):
        intent = classify_intent("Which role has better prospects: Cloud or DevOps?")
        assert intent == "career_comparison"


# ── 3. Resume & Skill Normalization Tests ──────────────────────────────────────

def test_skill_normalizer():
    """Verify skill normalization against canonical taxonomy."""
    norm = SkillNormalizer()
    raw = ["python3", "sql server", "docker containers", "react.js", "kubernetes"]
    normalized = norm.normalize(raw)
    assert len(normalized) > 0
    # Python should be normalized
    assert any("python" in s.lower() for s in normalized)


def test_resume_heuristic_fallback():
    """Verify heuristic resume parser extracts email and skills from plain text."""
    sample_text = (
        "John Doe\n"
        "john.doe@example.com\n"
        "Software Engineer with 3 years of experience in Python, SQL, Docker, and React.\n"
        "Education: Bachelor of Science in Computer Science\n"
    )
    res = _heuristic_resume_fallback(sample_text)
    assert res.email == "john.doe@example.com"
    assert res.experience_years == 3.0
    assert any("python" in s.lower() for s in res.skills)


def test_resume_noise_word_filtering():
    """Verify resume parsing drops section headers, degree titles and extracts only technical skills."""
    text = "Education: B.Tech Computer Science\nSkills: Python, FastAPI, Docker"
    res = _heuristic_resume_fallback(text)
    assert "Python" in res.skills
    assert "FastAPI" in res.skills
    assert "Docker" in res.skills
    assert "Education" not in res.skills
    assert "B.Tech" not in res.skills
    assert "Computer Science" not in res.skills
    lower_skills = [s.lower() for s in res.skills]
    assert "education" not in lower_skills
    assert "b.tech" not in lower_skills
    assert set(res.skills) == {"Docker", "FastAPI", "Python"}


# ── 4. Deterministic Python Validator Tests ────────────────────────────────────

def test_validator_catches_hallucinated_bps_and_percentage():
    """Validator must reject response containing metrics absent from ml_context."""
    hallucinated_text = "The role demand surged by 88.5% and increased by +450 bps in the latest quarter."
    context = {"forecast_6m_bps": 2.1, "growth_pct_6m": 12.5}
    val = validate_ai_response(hallucinated_text, ml_context=context, citations=["[Role Catalog: ROLE_001]"])
    assert val.passed is False
    assert len(val.flagged_numbers) > 0
    assert any("88.5" in v or "450" in v for v in val.violations)


def test_validator_catches_hallucinated_role():
    """Validator must reject roles that do not exist in the 60-role catalog."""
    hallucinated_text = "You should pursue a career as a Quantum Blockchain Ninja Engineer. [Role Catalog: ROLE_001]"
    context = {}
    val = validate_ai_response(hallucinated_text, ml_context=context, citations=["[Role Catalog: ROLE_001]"])
    assert val.passed is False
    assert any("Quantum Blockchain Ninja Engineer" in r for r in val.flagged_roles)


def test_validator_passes_grounded_metrics_and_roles():
    """Validator must pass responses containing verified numbers and catalog roles."""
    valid_text = (
        "For Machine Learning Engineer, 6M forecast is 2.73 bps with a 13.3% growth rate. "
        "[Role Catalog: ROLE_001] [SHAP Driver Analysis]"
    )
    context = {"forecast_6m_bps": 2.73, "growth_pct_6m": 13.3}
    val = validate_ai_response(valid_text, ml_context=context, citations=["[Role Catalog: ROLE_001]"])
    assert val.passed is True
    assert len(val.violations) == 0


# ── 5. FastAPI Endpoints Integration Tests ────────────────────────────────────

def test_ai_chat_endpoint_e2e():
    """Verify POST /ai/chat executes successfully and returns expected schema."""
    payload = {
        "message": "What is the demand outlook and required skills for Cloud Architect?",
        "user_id": "test-user-ai",
        "role_id": "ROLE_1001",
    }
    resp = client.post("/ai/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert "tools_used" in data
    assert "citations" in data
    assert "validation_passed" in data
    assert data["validation_passed"] is True


def test_ai_resume_confirm_endpoint():
    """Verify POST /ai/resume/confirm saves user skills to database."""
    payload = {
        "user_id": "test-resume-candidate",
        "skills": ["Python", "FastAPI", "Docker", "SQL"],
        "name": "Resume Candidate",
        "education": "B.Tech Computer Science",
        "experience_years": 2.0,
    }
    resp = client.post("/ai/resume/confirm", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "confirmed"
    assert data["user_id"] == "test-resume-candidate"
    assert "Python" in data["declared_skills"]


# ── 6. 4-Agent Supervisor, SQLite Checkpointer & MCP Integration Tests ─────────

def test_supervisor_4_agent_routing():
    """Verify Supervisor Router correctly maps queries to the 4 specialized agents."""
    from backend.ai.graph.workflow import classify_agent_route
    from backend.ai.llm_router import classify_intent

    # Agent 1: Career Advisor
    q1 = "Compare Machine Learning Engineer vs Data Scientist growth"
    assert classify_agent_route(q1, classify_intent(q1)) == "career_advisor"

    # Agent 2: Resume Intelligence
    q2 = "Review my resume experience and suggest bullet points"
    assert classify_agent_route(q2, classify_intent(q2)) == "resume_intelligence"

    # Agent 3: Skill Development
    q3 = "Give me a 6-month roadmap and portfolio project ideas"
    assert classify_agent_route(q3, classify_intent(q3)) == "skill_development"

    # Agent 4: Job Intelligence
    q4 = "Show me live hiring job openings in Bengaluru"
    assert classify_agent_route(q4, classify_intent(q4)) == "job_intelligence"


def test_sqlite_checkpointing_conversation_state():
    """Verify LangGraph Supervisor with SqliteSaver saves state per thread_id."""
    from backend.ai.graph.workflow import create_career_graph

    graph = create_career_graph()
    thread_id = "test-checkpoint-thread-42"
    config = {"configurable": {"thread_id": thread_id}}

    state_turn1 = {
        "query": "What are the job openings for MLOps?",
        "user_id": "test-user-chk",
        "session_id": "sess-chk",
        "role_id": "ROLE_1004",
        "intent": None,
        "ml_context": {},
        "rag_chunks": [],
        "tools_used": [],
        "citations": [],
        "draft_response": None,
        "final_response": None,
        "validation_passed": False,
        "violations": [],
        "retry_count": 0,
    }

    res1 = graph.invoke(state_turn1, config=config)
    assert res1.get("active_agent") == "Job Intelligence Agent"
    assert res1.get("validation_passed") is True

    # Retrieve checkpointed state directly via graph
    saved_state = graph.get_state(config)
    assert saved_state is not None
    assert saved_state.values.get("active_agent") == "Job Intelligence Agent"


def test_mcp_server_and_client_adapter():
    """Verify FastMCP server registers all 4 tool groups and client adapter executes correctly."""
    import asyncio
    from backend.mcp.client_adapter import MCPClientAdapter

    adapter = MCPClientAdapter()
    tools = asyncio.run(adapter.list_tools())
    tool_names = [t["name"] if isinstance(t, dict) else t.name for t in tools]

    # Verify all 4 tool groups exist
    assert "get_role_catalog" in tool_names
    assert "get_role_forecast_and_shap" in tool_names
    assert "search_career_knowledge" in tool_names
    assert "search_matching_jobs" in tool_names
    assert "get_user_profile" in tool_names
    assert len(tools) == 10

    # Test tool execution
    catalog_res = asyncio.run(adapter.call_tool("get_role_catalog", {}))
    assert catalog_res is not None
    if isinstance(catalog_res, list):
        assert len(catalog_res) == 60
    elif isinstance(catalog_res, dict):
        assert len(catalog_res.get("result", [])) == 60 or catalog_res.get("total_roles") == 60


def test_rag_metadata_filtering_role_id():
    """Verify Hybrid RAG retriever enforces metadata filtering by role_id."""
    # Retrieve only chunks for ROLE_1001 (Generative AI Engineer)
    res = retrieve_chunks("generative ai llm prompt engineering", top_k=4, role_id="ROLE_1001")
    chunks = res.get("chunks", [])
    assert len(chunks) > 0
    for c in chunks:
        assert c.get("role_id") == "ROLE_1001"

