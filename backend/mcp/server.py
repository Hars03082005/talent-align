"""
backend/mcp/server.py
=====================
Model Context Protocol (MCP) server for TalentAlign using FastMCP.
Exposes 4 standardized tool groups for external MCP clients and LangGraph agents:
  - Group 1: ML Intelligence
  - Group 2: RAG Knowledge
  - Group 3: Job Intelligence
  - Group 4: User Profile
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastmcp import FastMCP

from backend.data_loader import (
    load_role_catalog,
    get_role_by_id,
    get_role_by_name,
    sanitize_role_name,
)
from backend.ai.rag.retriever import retrieve_chunks
from backend.database import SessionLocal
from backend import db_repository as repo
from backend.jobs.matcher import compute_job_match
from src.recommendation.role_matcher import RoleMatcher
from src.recommendation.skill_gap import compute_skill_gap
from src.recommendation.roadmap import generate_roadmap

mcp = FastMCP("TalentAlign Career Intelligence MCP Server")


# ── Group 1: ML Intelligence ──────────────────────────────────────────────────

@mcp.tool()
def get_role_catalog() -> List[Dict[str, Any]]:
    """Retrieve the full 60-role catalog of established roles and emerging clusters."""
    catalog = load_role_catalog()
    return [
        {
            "role_id": r.get("role_id"),
            "role_name": r.get("role_name"),
            "source_type": r.get("source_type"),
            "role_family": r.get("role_family"),
            "forecast_6m_bps": r.get("forecast_6m_bps"),
            "growth_pct_6m": r.get("growth_pct_6m"),
            "confidence_label": r.get("confidence_label"),
        }
        for r in catalog
    ]


@mcp.tool()
def get_role_forecast_and_shap(role_id: str) -> Dict[str, Any]:
    """Retrieve 6M/12M demand forecasts and SHAP market driver explanations for a role."""
    role = get_role_by_id(role_id) or get_role_by_name(role_id)
    if not role:
        return {"error": f"Role '{role_id}' not found in catalog."}

    return {
        "role_id": role.get("role_id"),
        "role_name": sanitize_role_name(role.get("role_id", ""), role.get("role_name", "")),
        "source_type": role.get("source_type"),
        "forecast_6m_bps": role.get("forecast_6m_bps"),
        "forecast_12m_bps": role.get("forecast_12m_bps"),
        "growth_pct_6m": role.get("growth_pct_6m"),
        "confidence_label": role.get("confidence_label"),
        "shap_top_drivers": role.get("shap_top_drivers", []),
        "required_skills": role.get("required_skills", []),
        "frontier_skills": role.get("frontier_skills", []),
    }


@mcp.tool()
def compute_role_matches(user_profile: Dict[str, Any], top_n: int = 5) -> List[Dict[str, Any]]:
    """Compute deterministic multi-factor role recommendations for a candidate profile."""
    matcher = RoleMatcher(catalog=load_role_catalog())
    top_recs, _ = matcher.rank(user_profile, top_n=top_n)
    return [
        {
            "rank": r.get("rank"),
            "role_id": r.get("role_id"),
            "role_name": sanitize_role_name(r.get("role_id", ""), r.get("role_name", "")),
            "personal_fit": r.get("personal_fit"),
            "future_potential": r.get("future_potential"),
            "current_readiness": r.get("current_readiness"),
            "final_score": r.get("final_score"),
            "why_this_role": r.get("why_this_role", []),
        }
        for r in top_recs
    ]


# ── Group 2: RAG Knowledge ───────────────────────────────────────────────────

@mcp.tool()
def search_career_knowledge(
    query: str,
    role_id: Optional[str] = None,
    section: Optional[str] = None,
    source: Optional[str] = None,
    top_k: int = 5,
) -> Dict[str, Any]:
    """
    Search the curated career knowledge base using Hybrid RAG (BM25 + Dense + Cross-Encoder)
    with strict metadata filtering.
    """
    return retrieve_chunks(
        query=query,
        top_k=top_k,
        role_id=role_id,
        section=section,
        source=source,
    )


# ── Group 3: Job Intelligence ────────────────────────────────────────────────

@mcp.tool()
def search_matching_jobs(
    role_id: Optional[str] = None,
    location: Optional[str] = None,
    experience: Optional[str] = None,
    work_mode: Optional[str] = None,
    user_skills: Optional[List[str]] = None,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """Search live verified job listings in SQLite with deterministic skill and title matching."""
    with SessionLocal() as db:
        jobs = repo.search_job_listings(
            db,
            role_id=role_id,
            location=location,
            work_mode=work_mode,
            experience_level=experience,
            limit=limit,
        )

        results = []
        for j in jobs:
            match_res = compute_job_match(
                candidate_profile={"declared_skills": user_skills or []},
                job={
                    "required_skills": j.get_required_skills(),
                    "preferred_skills": j.get_preferred_skills(),
                    "title": j.title,
                    "experience_level": j.experience_level,
                    "work_mode": j.work_mode,
                    "location": j.location,
                },
            )
            results.append({
                "id": j.id,
                "title": j.title,
                "company": j.company,
                "location": j.location,
                "work_mode": j.work_mode,
                "experience_level": j.experience_level,
                "required_skills": j.get_required_skills(),
                "source_url": j.source_url,
                "posted_at": j.posted_at.isoformat() if j.posted_at else None,
                "match_score": match_res["match_score"],
                "matched_skills": match_res["matched_skills"],
                "missing_skills": match_res["missing_skills"],
            })

        results.sort(key=lambda x: x["match_score"], reverse=True)
        return results


@mcp.tool()
def get_job_details(job_id: str) -> Dict[str, Any]:
    """Retrieve full details for a specific verified job listing."""
    with SessionLocal() as db:
        job = repo.get_job_listing_by_id(db, job_id)
        if not job:
            return {"error": f"Job listing '{job_id}' not found."}

        return {
            "id": job.id,
            "title": job.title,
            "company": job.company,
            "location": job.location,
            "work_mode": job.work_mode,
            "experience_level": job.experience_level,
            "required_skills": job.get_required_skills(),
            "preferred_skills": job.get_preferred_skills(),
            "source": job.source,
            "source_url": job.source_url,
            "posted_at": job.posted_at.isoformat() if job.posted_at else None,
        }


@mcp.tool()
def save_job_application(user_id: str, job_id: str, status: str = "saved") -> Dict[str, Any]:
    """Track a candidate job application status in SQLite (saved, applied, shortlisted, rejected)."""
    with SessionLocal() as db:
        app = repo.save_or_update_job_application(db, user_id=user_id, job_id=job_id, status=status)
        return {
            "id": app.id,
            "user_id": app.user_id,
            "job_id": app.job_id,
            "status": app.status,
            "updated_at": app.updated_at.isoformat(),
        }


# ── Group 4: User Profile ─────────────────────────────────────────────────────

@mcp.tool()
def get_user_profile(user_id: str) -> Dict[str, Any]:
    """Retrieve verified candidate profile, BAIO psychometrics, and confirmed skills."""
    with SessionLocal() as db:
        u = repo.get_user(db, user_id)
        if not u:
            return {"error": f"User '{user_id}' not found."}

        return {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "education": u.education,
            "experience_level": u.experience_level,
            "declared_skills": json.loads(u.declared_skills or "[]"),
            "primary_archetype": u.primary_archetype,
            "secondary_archetype": u.secondary_archetype,
        }


@mcp.tool()
def get_user_skill_gap(role_id: str, user_skills: List[str]) -> Dict[str, Any]:
    """Compute exact skill gap (possessed vs. missing vs. frontier) for a role."""
    role = get_role_by_id(role_id) or get_role_by_name(role_id)
    if not role:
        return {"error": f"Role '{role_id}' not found."}

    return compute_skill_gap(role, user_skills)


@mcp.tool()
def get_baseline_roadmap(role_id: str, user_skills: List[str]) -> Dict[str, Any]:
    """Generate deterministic 3-phase learning roadmap for a role."""
    role = get_role_by_id(role_id) or get_role_by_name(role_id)
    if not role:
        return {"error": f"Role '{role_id}' not found."}

    gap = compute_skill_gap(role, user_skills)
    return generate_roadmap(role, gap)


if __name__ == "__main__":
    mcp.run()
