"""
backend/ai/agents/advisor_agent.py
==================================
Career Advisor & Roadmap Agent.
Coordinates ML context aggregation, RAG grounding, prompt synthesis,
and validation correction.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from backend.ai.llm_router import generate_response
from backend.ai.rag.retriever import retrieve_chunks
from backend.ai.tools.ml_tools import (
    get_role_details_and_shap,
    get_role_matches,
    get_skill_gap_and_roadmap,
    get_user_profile,
)
from backend.ai.validator import validate_ai_response
from backend.data_loader import build_role_index, get_role_by_id, get_role_by_name

logger = logging.getLogger(__name__)


def gather_ml_context(
    query: str,
    intent: str,
    user_id: Optional[str],
    session_id: Optional[str],
    role_id: Optional[str],
    db: Optional[Session],
) -> Tuple[Dict[str, Any], List[str], List[str]]:
    """
    Query existing Python ML tools strictly based on intent and input IDs.
    Returns (ml_context_dict, tools_used_list, citations_list).
    """
    context: Dict[str, Any] = {}
    tools_used: List[str] = []
    citations: List[str] = []

    # Detect role name or role_id from query if not explicitly passed
    detected_role_id = role_id
    if not detected_role_id:
        idx = build_role_index()
        q_lower = query.lower()
        for key, r in idx.items():
            if not key.startswith("name:"):
                r_name = str(r.get("role_name", "")).lower()
                if r_name and r_name in q_lower:
                    detected_role_id = r.get("role_id")
                    break

    # 1. User Profile Tool
    user_skills: List[str] = []
    if user_id and db is not None:
        prof = get_user_profile(user_id, db)
        if prof.get("status") != "not_found":
            context["user_profile"] = prof
            tools_used.append("get_user_profile")
            citations.append(f"[User Profile: {user_id}]")
            user_skills = prof.get("declared_skills", [])

    # 2. Role Matches Tool
    if session_id and db is not None:
        matches = get_role_matches(session_id, db)
        if matches:
            context["role_matches"] = matches
            tools_used.append("get_role_matches")
            citations.append(f"[Role Recommendations: Session {session_id}]")

    # 3. Role Details & SHAP Tool
    target_role = detected_role_id or "ROLE_001"
    role_info = get_role_details_and_shap(target_role)
    if role_info:
        context["target_role_info"] = role_info
        tools_used.append("get_role_details_and_shap")
        citations.append(f"[Role Catalog: {role_info.get('role_id')}]")
        if role_info.get("shap_drivers"):
            citations.append("[SHAP Driver Analysis]")

    # 4. Skill Gap & Roadmap Tool
    if intent in ["roadmap_help", "readiness_check", "career_comparison"] or detected_role_id:
        gap_data = get_skill_gap_and_roadmap(user_skills, target_role)
        if gap_data.get("data_available"):
            context["skill_gap_and_roadmap"] = gap_data
            tools_used.append("get_skill_gap_and_roadmap")
            citations.append(f"[Roadmap & SkillGap: {target_role}]")

    return context, tools_used, citations


def build_advisor_prompt(
    query: str,
    intent: str,
    ml_context: Dict[str, Any],
    rag_chunks: List[Dict[str, Any]],
    citations: List[str],
) -> str:
    """Construct grounded prompt with explicit context and citation instructions."""
    context_sections = []

    # Format ML Context
    if "user_profile" in ml_context:
        up = ml_context["user_profile"]
        context_sections.append(
            f"Candidate Profile: Name: {up.get('name')}, Experience: {up.get('experience_years')} yrs, "
            f"Archetype: {up.get('primary_archetype')}, "
            f"Skills: {', '.join(up.get('declared_skills', []))}"
        )

    if "target_role_info" in ml_context:
        ri = ml_context["target_role_info"]
        shap_pos = ""
        if ri.get("shap_drivers") and "top_positive_drivers" in ri["shap_drivers"]:
            shap_pos = ", ".join([d.get("description", "") for d in ri["shap_drivers"]["top_positive_drivers"][:3]])

        context_sections.append(
            f"Role Intelligence for {ri.get('role_name')} ({ri.get('role_id')}):\n"
            f"- 6M Demand Forecast: {ri.get('forecast_6m_bps')} bps ({ri.get('growth_pct_6m')}% growth)\n"
            f"- 12M Demand Forecast: {ri.get('forecast_12m_bps')} bps ({ri.get('growth_pct_12m')}% growth)\n"
            f"- Growth Tier: {ri.get('growth_tier')}, Confidence: {ri.get('confidence_label')}\n"
            f"- Required Core Skills: {', '.join(ri.get('required_skills', []))}\n"
            f"- Frontier Emerging Skills: {', '.join(ri.get('frontier_skills', []))}\n"
            f"- Market Growth Drivers (SHAP): {shap_pos}"
        )

    if "role_matches" in ml_context:
        m_lines = [
            f"Rank #{m.get('rank')}: {m.get('role_name')} (Overall Fit: {m.get('final_score')}%, Readiness: {m.get('current_readiness')}%)"
            for m in ml_context["role_matches"][:3]
        ]
        context_sections.append("Candidate Role Match Results:\n" + "\n".join(m_lines))

    if "skill_gap_and_roadmap" in ml_context:
        sg = ml_context["skill_gap_and_roadmap"]
        gap = sg.get("skill_gap", {})
        context_sections.append(
            f"Skill Gap for {sg.get('role_name')}:\n"
            f"- Skills Already Possessed: {', '.join(gap.get('already_have', []))}\n"
            f"- Missing Core Skills to Learn: {', '.join(gap.get('need_to_learn', []))}\n"
            f"- Optional Frontier Skills: {', '.join(gap.get('optional_advanced', []))}"
        )

    # Format RAG Chunks
    if rag_chunks:
        chunk_lines = [f"[{c.get('source')}: {c.get('role_name')}] {c.get('text')}" for c in rag_chunks]
        context_sections.append("Verified Catalog Knowledge & Project Guides:\n" + "\n\n".join(chunk_lines))

    grounding_str = "\n\n".join(context_sections)

    prompt = (
        f"You are the Proactive Talent Alignment Career Advisor. Answer the candidate's query with actionable guidance.\n"
        f"MANDATORY RULES:\n"
        f"1. Use ONLY the metrics, numbers (% / bps), and skills listed above.\n"
        f"2. Cite your sources using bracket tags: {', '.join(citations)}.\n"
        f"3. Provide 2-3 concrete project ideas for any missing skills.\n\n"
        f"Candidate Query: {query}"
    )

    return prompt, grounding_str
