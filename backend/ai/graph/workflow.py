"""
backend/ai/graph/workflow.py
============================
LangGraph Supervisor StateGraph for Career Intelligence with 4 specialized agents:
  1. Career Advisor Agent (role comparisons, LightGBM forecasts, SHAP drivers, BAIO alignment)
  2. Resume Intelligence Agent (resume gaps, bullet improvements, confirmation gating)
  3. Skill Development Agent (skill gaps, progressive learning roadmaps, portfolio projects)
  4. Job Intelligence Agent (real job matching in SQLite, company openings, real source_urls)

Backed by SqliteSaver for persistent multi-turn conversational checkpointing per session/thread.
Every output passes through deterministic Python validation with 1 retry loop on failure.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from backend.ai.agents.advisor_agent import build_advisor_prompt, gather_ml_context
from backend.ai.graph.state import AgentState
from backend.ai.llm_router import classify_intent, generate_response
from backend.ai.rag.retriever import retrieve_chunks
from backend.ai.validator import validate_ai_response
from backend.ai.tools.ml_tools import (
    get_role_details_and_shap,
    get_role_matches,
    get_skill_gap_and_roadmap,
    get_user_profile,
)
from backend.database import SessionLocal
from backend import db_repository as repo
from backend.jobs.matcher import compute_job_match

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[3]
CHECKPOINTS_DB_PATH = BASE_DIR / "data" / "application" / "langgraph_checkpoints.db"
CHECKPOINTS_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# Shared SQLite checkpoint database connection
_checkpoint_conn = sqlite3.connect(str(CHECKPOINTS_DB_PATH), check_same_thread=False)
sqlite_saver = SqliteSaver(_checkpoint_conn)


def classify_agent_route(query: str, raw_intent: str) -> str:
    """Map query and intent to one of the 4 specialized agent workflows."""
    q_lower = query.lower()

    # Priority 1: Resume Intelligence keywords (take precedence over generic words like positions)
    if any(k in q_lower for k in ["resume", "cv", "bullet", "bullet point", "experience section", "my profile", "update my skills"]):
        return "resume_intelligence"

    # Priority 2: Job Intelligence keywords
    if any(k in q_lower for k in ["job", "jobs", "hiring", "openings", "vacancies", "open roles", "positions", "apply"]):
        return "job_intelligence"

    # Priority 3: Skill Development keywords (avoid false positives on 'machine learning')
    if any(k in q_lower for k in ["roadmap", "study plan", "curriculum", "courses", "practice project", "portfolio project", "how to learn", "what to learn", "skills to learn", "learning path", "action plan"]):
        return "skill_development"

    # Priority 4: Map from classified intent
    if raw_intent == "resume_analysis":
        return "resume_intelligence"
    elif raw_intent == "roadmap_help":
        return "skill_development"
    elif raw_intent in ["career_comparison", "readiness_check", "general_role_info"]:
        return "career_advisor"

    return "career_advisor"


def create_career_graph(db: Optional[Session] = None, checkpointer: Optional[SqliteSaver] = sqlite_saver):
    """
    Factory to build and compile the 4-Agent LangGraph Supervisor with SqliteSaver persistence.
    """

    # ── Node 1: Supervisor Intent Router ──────────────────────────────────────
    def supervisor_router_node(state: AgentState) -> Dict[str, Any]:
        query = state["query"]
        raw_intent = classify_intent(query)
        selected_agent = classify_agent_route(query, raw_intent)
        logger.info(f"Supervisor Router: query='{query}' -> intent='{raw_intent}' -> agent='{selected_agent}'")
        return {
            "intent": raw_intent,
            "active_agent": selected_agent,
        }

    # ── Node 2A: Career Advisor Agent ─────────────────────────────────────────
    def career_advisor_node(state: AgentState) -> Dict[str, Any]:
        ml_ctx, tools_used, citations = gather_ml_context(
            query=state["query"],
            intent=state.get("intent", "career_comparison"),
            user_id=state.get("user_id"),
            session_id=state.get("session_id"),
            role_id=state.get("role_id"),
            db=db,
        )

        rag_res = retrieve_chunks(state["query"], top_k=4, role_id=state.get("role_id"))
        rag_chunks = rag_res.get("chunks", [])
        for c in rag_chunks:
            cit = f"[{c.get('source')}: {c.get('role_name')}]"
            if cit not in citations:
                citations.append(cit)

        prompt, context_str = build_advisor_prompt(
            query=state["query"],
            intent=state.get("intent", "career_comparison"),
            ml_context=ml_ctx,
            rag_chunks=rag_chunks,
            citations=citations,
        )

        draft = generate_response(prompt=prompt, context=context_str)
        return {
            "active_agent": "Career Advisor Agent",
            "ml_context": ml_ctx,
            "rag_chunks": rag_chunks,
            "tools_used": tools_used or ["get_role_details_and_shap"],
            "citations": citations,
            "draft_response": draft,
        }

    # ── Node 2B: Resume Intelligence Agent ────────────────────────────────────
    def resume_intelligence_node(state: AgentState) -> Dict[str, Any]:
        citations = list(state.get("citations", []))
        tools_used = ["get_user_profile", "get_user_skill_gap"]

        user_skills = []
        user_name = "Candidate"
        if state.get("user_id") and db is not None:
            prof = get_user_profile(state["user_id"], db)
            if prof.get("status") != "not_found":
                user_skills = prof.get("declared_skills", [])
                user_name = prof.get("name", "Candidate")
                citations.append(f"[User Profile: {state['user_id']}]")

        target_role = state.get("role_id") or "ROLE_001"
        gap_data = get_skill_gap_and_roadmap(user_skills, target_role)
        role_name = gap_data.get("role_name", target_role)
        missing_skills = gap_data.get("need_to_learn", [])[:4]

        # RAG grounding on resume expectations
        rag_res = retrieve_chunks(f"Resume and interview expectations for {role_name}", top_k=3, role_id=target_role)
        rag_chunks = rag_res.get("chunks", [])
        for c in rag_chunks:
            cit = f"[{c.get('source')}: {c.get('role_name')}]"
            if cit not in citations:
                citations.append(cit)

        context_str = (
            f"Candidate Name: {user_name}\n"
            f"Target Role: {role_name}\n"
            f"Current Confirmed Skills: {', '.join(user_skills) if user_skills else 'None declared'}\n"
            f"Identified Missing Skills: {', '.join(missing_skills) if missing_skills else 'No gaps detected'}\n"
        )

        prompt = (
            f"Candidate Inquiry: {state['query']}\n\n"
            f"As the Resume Intelligence Agent for TalentAlign:\n"
            f"1. Explain how the candidate's current profile aligns with {role_name} and where gaps exist.\n"
            f"2. Suggest 2-3 high-impact, quantifiable resume bullet points incorporating missing skills ({', '.join(missing_skills)}).\n"
            f"3. Follow the Google X-Y-Z formula: Accomplished [X] as measured by [Y], by doing [Z].\n"
            f"4. Add this mandatory disclaimer at the end: 'Note: Profile modifications require your explicit confirmation before updating.'\n"
            f"Provenance Citations to include: {', '.join(citations[:3])}"
        )

        draft = generate_response(prompt=prompt, context=context_str)
        return {
            "active_agent": "Resume Intelligence Agent",
            "ml_context": {"role_name": role_name, "missing_skills": missing_skills},
            "rag_chunks": rag_chunks,
            "tools_used": tools_used,
            "citations": citations,
            "draft_response": draft,
        }

    # ── Node 2C: Skill Development Agent ──────────────────────────────────────
    def skill_development_node(state: AgentState) -> Dict[str, Any]:
        citations = list(state.get("citations", []))
        tools_used = ["get_user_skill_gap", "get_baseline_roadmap", "search_career_knowledge"]

        user_skills = []
        if state.get("user_id") and db is not None:
            prof = get_user_profile(state["user_id"], db)
            if prof.get("status") != "not_found":
                user_skills = prof.get("declared_skills", [])
                citations.append(f"[User Profile: {state['user_id']}]")

        target_role = state.get("role_id") or "ROLE_001"
        gap_data = get_skill_gap_and_roadmap(user_skills, target_role)
        role_name = gap_data.get("role_name", target_role)
        missing_skills = gap_data.get("need_to_learn", [])[:5]

        # Hybrid RAG search for practical portfolio projects & learning milestones
        rag_res = retrieve_chunks(
            f"Learning resources and capstone project ideas for {role_name} skills {', '.join(missing_skills)}",
            top_k=4,
            role_id=target_role,
        )
        rag_chunks = rag_res.get("chunks", [])
        for c in rag_chunks:
            cit = f"[{c.get('source')}: {c.get('role_name')}]"
            if cit not in citations:
                citations.append(cit)

        context_str = (
            f"Target Role: {role_name}\n"
            f"Missing Skills: {', '.join(missing_skills)}\n"
            f"Stages: {json.dumps(gap_data.get('stages', []))}\n"
        )

        prompt = (
            f"Candidate Inquiry: {state['query']}\n\n"
            f"As the Skill Development Agent for TalentAlign:\n"
            f"1. Provide a progressive 3-phase curriculum (Months 1–2, 3–4, 5–6) specifically targeting: {', '.join(missing_skills)}.\n"
            f"2. Detail concrete weekly milestone tasks for each phase.\n"
            f"3. Propose a production-grade portfolio capstone project with measurable deliverables.\n"
            f"4. Ground all recommendations strictly in verified catalog skills and include provenance citations: {', '.join(citations[:3])}."
        )

        draft = generate_response(prompt=prompt, context=context_str)
        return {
            "active_agent": "Skill Development Agent",
            "ml_context": {"role_name": role_name, "missing_skills": missing_skills},
            "rag_chunks": rag_chunks,
            "tools_used": tools_used,
            "citations": citations,
            "draft_response": draft,
        }

    # ── Node 2D: Job Intelligence Agent ───────────────────────────────────────
    def job_intelligence_node(state: AgentState) -> Dict[str, Any]:
        citations = list(state.get("citations", []))
        tools_used = ["search_matching_jobs", "score_job_match"]

        user_skills = []
        if state.get("user_id") and db is not None:
            prof = get_user_profile(state["user_id"], db)
            if prof.get("status") != "not_found":
                user_skills = prof.get("declared_skills", [])
                citations.append(f"[User Profile: {state['user_id']}]")

        target_role = state.get("role_id")
        with SessionLocal() as local_db:
            jobs = repo.search_job_listings(
                local_db,
                role_id=target_role,
                limit=15,
            )

        scored_jobs = []
        for j in jobs:
            match_res = compute_job_match(
                candidate_profile={"declared_skills": user_skills},
                job={
                    "required_skills": j.get_required_skills(),
                    "preferred_skills": j.get_preferred_skills(),
                    "title": j.title,
                    "experience_level": j.experience_level,
                    "work_mode": j.work_mode,
                    "location": j.location,
                },
            )
            scored_jobs.append({
                "title": j.title,
                "company": j.company,
                "location": j.location,
                "work_mode": j.work_mode,
                "experience_level": j.experience_level,
                "match_score": match_res["match_score"],
                "matched_skills": match_res["matched_skills"],
                "missing_skills": match_res["missing_skills"],
                "source_url": j.source_url,
            })

        scored_jobs.sort(key=lambda x: x["match_score"], reverse=True)
        top_jobs = scored_jobs[:3]

        citations.append("[Job Listings: SQLite Verified]")

        job_bullets = []
        for j in top_jobs:
            score_badge = f"{j['match_score']}% Match"
            job_bullets.append(
                f"- **{j['title']}** at **{j['company']}** ({j['location']} · {j['work_mode']}) — {score_badge}\n"
                f"  - Matched: {', '.join(j['matched_skills'][:4]) if j['matched_skills'] else 'Profile overlap'}\n"
                f"  - Missing: {', '.join(j['missing_skills'][:3]) if j['missing_skills'] else 'None'}\n"
                f"  - [Apply on Company Site]({j['source_url']})"
            )

        draft = (
            f"Here are the top verified job openings matching your profile in our live database:\n\n"
            + "\n".join(job_bullets)
            + f"\n\n*All openings are deduplicated via SHA-256 and matched deterministically against your declared skills.* [Job Listings: SQLite Verified]"
        )

        return {
            "active_agent": "Job Intelligence Agent",
            "ml_context": {
                "top_jobs_count": len(top_jobs),
                "job_matches": [j["match_score"] for j in top_jobs],
                "job_titles": [j["title"] for j in top_jobs],
                "allowed_roles": [j["title"] for j in top_jobs],
            },
            "rag_chunks": [],
            "tools_used": tools_used,
            "citations": citations,
            "draft_response": draft,
        }

    # ── Node 3: Validation Node ───────────────────────────────────────────────
    def validate_node(state: AgentState) -> Dict[str, Any]:
        draft = state.get("draft_response", "") or ""
        val = validate_ai_response(
            text=draft,
            ml_context=state.get("ml_context", {}),
            citations=state.get("citations", []),
        )
        return {
            "validation_passed": val.passed,
            "violations": val.violations,
        }

    # ── Node 4: Correction Node (1 retry loop) ─────────────────────────────────
    def correction_node(state: AgentState) -> Dict[str, Any]:
        violations = state.get("violations", [])
        retry_count = state.get("retry_count", 0) + 1
        logger.warning(f"LangGraph Validator correction pass (attempt {retry_count}): {violations}")

        draft = state.get("draft_response", "")
        correction_prompt = (
            f"Original Draft:\n{draft}\n\n"
            f"CRITICAL CORRECTION REQUIRED:\n"
            + "\n".join([f"- {v}" for v in violations])
            + "\nRe-write the response removing any ungrounded figures, using only catalog role names, and including citations."
        )

        corrected = generate_response(prompt=correction_prompt, context="")
        re_val = validate_ai_response(
            text=corrected,
            ml_context=state.get("ml_context", {}),
            citations=state.get("citations", []),
        )

        if not re_val.passed:
            from backend.ai.llm_router import _deterministic_grounded_fallback
            corrected = _deterministic_grounded_fallback(state["query"], "")
            re_val.passed = True

        return {
            "draft_response": corrected,
            "final_response": corrected,
            "validation_passed": re_val.passed,
            "violations": re_val.violations,
            "retry_count": retry_count,
        }

    # ── Node 5: Finalize Node ─────────────────────────────────────────────────
    def finalize_node(state: AgentState) -> Dict[str, Any]:
        return {
            "final_response": state.get("draft_response", ""),
        }

    # ── Supervisor Conditional Router ─────────────────────────────────────────
    def supervisor_route_choice(state: AgentState) -> str:
        agent = state.get("active_agent") or "career_advisor"
        if agent in ["career_advisor", "resume_intelligence", "skill_development", "job_intelligence"]:
            return agent
        return "career_advisor"

    def validation_route_choice(state: AgentState) -> str:
        if state.get("validation_passed", False) or state.get("retry_count", 0) >= 1:
            return "finalize"
        return "correct"

    # ── StateGraph Assembly ───────────────────────────────────────────────────
    workflow = StateGraph(AgentState)

    workflow.add_node("supervisor_router", supervisor_router_node)
    workflow.add_node("career_advisor", career_advisor_node)
    workflow.add_node("resume_intelligence", resume_intelligence_node)
    workflow.add_node("skill_development", skill_development_node)
    workflow.add_node("job_intelligence", job_intelligence_node)
    workflow.add_node("validate", validate_node)
    workflow.add_node("correct", correction_node)
    workflow.add_node("finalize", finalize_node)

    workflow.add_edge(START, "supervisor_router")

    workflow.add_conditional_edges(
        "supervisor_router",
        supervisor_route_choice,
        {
            "career_advisor": "career_advisor",
            "resume_intelligence": "resume_intelligence",
            "skill_development": "skill_development",
            "job_intelligence": "job_intelligence",
        },
    )

    for agent_node in ["career_advisor", "resume_intelligence", "skill_development", "job_intelligence"]:
        workflow.add_edge(agent_node, "validate")

    workflow.add_conditional_edges(
        "validate",
        validation_route_choice,
        {
            "finalize": "finalize",
            "correct": "correct",
        },
    )

    workflow.add_edge("correct", "finalize")
    workflow.add_edge("finalize", END)

    # Compile with SQLite persistent checkpointer
    if checkpointer is not None:
        return workflow.compile(checkpointer=checkpointer)
    return workflow.compile()
