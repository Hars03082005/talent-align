"""
backend/ai/tools/ml_tools.py
============================
Clean tool wrappers around existing Python ML modules and database repositories.
STRICT RULE: The LLM never calculates match scores, forecasts, or invents skills.
All numerical data and recommendations come strictly from these tools.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend import db_repository as repo
from backend.data_loader import get_role_by_id, get_role_by_name, load_role_catalog
from src.recommendation.profile_engine import build_user_profile
from src.recommendation.roadmap import generate_roadmap
from src.recommendation.role_matcher import RoleMatcher
from src.recommendation.skill_gap import compute_skill_gap

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[3]
SHAP_PATH = BASE_DIR / "outputs" / "explanations" / "role_explanations.json"

_ROLE_MATCHER_INSTANCE: Optional[RoleMatcher] = None


def _get_role_matcher() -> RoleMatcher:
    global _ROLE_MATCHER_INSTANCE
    if _ROLE_MATCHER_INSTANCE is None:
        _ROLE_MATCHER_INSTANCE = RoleMatcher()
    return _ROLE_MATCHER_INSTANCE


def get_user_profile(user_id: str, db: Session) -> Dict[str, Any]:
    """
    Retrieve candidate profile from SQLite application database.
    Returns declared skills, interests, education, and BAIO archetype scores.
    """
    user = repo.get_user(db, user_id)
    if not user:
        return {
            "user_id": user_id,
            "status": "not_found",
            "declared_skills": [],
            "declared_interests": [],
            "experience_level": "Entry Level",
            "experience_years": 0.0,
            "name": "Anonymous Candidate",
        }

    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "education": user.education,
        "degree_stream": user.degree_stream,
        "experience_level": user.experience_level,
        "experience_years": getattr(user, "experience_years", 0.0),
        "declared_skills": user.get_declared_skills(),
        "declared_interests": user.get_declared_interests(),
        "primary_archetype": getattr(user, "primary_archetype", None),
        "secondary_archetype": getattr(user, "secondary_archetype", None),
        "baio_scores": user.get_baio_scores() if hasattr(user, "get_baio_scores") else {},
    }


def get_role_matches(session_id: str, db: Session) -> List[Dict[str, Any]]:
    """
    Retrieve top-5 multi-factor role recommendations for an assessment session.
    Pulls from immutable snapshots if saved, or runs the deterministic RoleMatcher.
    """
    # 1. Try saved snapshots from database
    snapshots = repo.get_session_snapshots(db, session_id)
    if snapshots:
        results = []
        for s in snapshots[:5]:
            results.append(
                {
                    "rank": s.rank,
                    "role_id": s.role_id,
                    "role_name": s.role_name,
                    "personal_fit": round(s.personal_fit * 100, 1),
                    "future_potential": round(s.future_potential * 100, 1),
                    "current_readiness": round(s.current_readiness * 100, 1),
                    "final_score": round(s.final_score * 100, 1),
                    "source_type": s.source_type,
                    "confidence_label": s.confidence_label,
                }
            )
        return results

    # 2. If session exists but no snapshots, compute via RoleMatcher
    db_session = repo.get_assessment_session(db, session_id)
    if db_session:
        user = repo.get_user(db, db_session.user_id)
        if user:
            answers = [
                {
                    "question_id": a.question_id,
                    "selected_option_index": a.selected_option_index,
                    "stage": a.stage,
                    "dimension_weights": a.get_dimension_weights(),
                }
                for a in db_session.answers
            ]
            profile_dict = build_user_profile(
                user_id=user.id,
                answers=answers,
                declared_skills=user.get_declared_skills(),
                declared_interests=user.get_declared_interests(),
            )
            matcher = _get_role_matcher()
            top_recs, _ = matcher.rank(profile_dict)
            return [
                {
                    "rank": r.get("rank"),
                    "role_id": r.get("role_id"),
                    "role_name": r.get("role_name"),
                    "personal_fit": round(r.get("personal_fit", 0.0) * 100, 1),
                    "future_potential": round(r.get("future_potential", 0.0) * 100, 1),
                    "current_readiness": round(r.get("current_readiness", 0.0) * 100, 1),
                    "final_score": round(r.get("final_score", 0.0) * 100, 1),
                    "source_type": r.get("source_type"),
                    "confidence_label": r.get("confidence_label"),
                }
                for r in top_recs[:5]
            ]

    return []


def get_role_details_and_shap(role_id_or_name: str) -> Optional[Dict[str, Any]]:
    """
    Look up role from the 60-role catalog by ID or name and attach SHAP market drivers.
    Returns exact forecast figures (bps / %) and verified skill lists.
    """
    role = get_role_by_id(role_id_or_name) or get_role_by_name(role_id_or_name)
    if not role:
        return None

    role_name = role.get("role_name", "")

    # Attach SHAP explanations
    shap_drivers: Dict[str, Any] = {}
    if SHAP_PATH.exists():
        try:
            with open(SHAP_PATH, encoding="utf-8") as f:
                shap_all = json.load(f)
            if role_name in shap_all:
                shap_drivers = shap_all[role_name]
        except Exception as e:
            logger.warning(f"Error reading SHAP file: {e}")

    return {
        "role_id": role.get("role_id"),
        "role_name": role_name,
        "classification": role.get("classification"),
        "source_type": role.get("source_type"),
        "forecast_method": role.get("forecast_method"),
        "role_family": role.get("role_family"),
        "current_demand_bps": role.get("current_demand_bps"),
        "forecast_6m_bps": role.get("forecast_6m_bps"),
        "forecast_12m_bps": role.get("forecast_12m_bps"),
        "growth_pct_6m": role.get("growth_pct_6m"),
        "growth_pct_12m": role.get("growth_pct_12m"),
        "growth_tier": role.get("growth_tier"),
        "confidence_label": role.get("confidence_label"),
        "required_skills": role.get("required_skills", []),
        "frontier_skills": role.get("frontier_skills", []),
        "shap_drivers": shap_drivers,
    }


def get_skill_gap_and_roadmap(user_skills: List[str], role_id_or_name: str) -> Dict[str, Any]:
    """
    Execute deterministic skill gap analysis and generate the 4-stage learning roadmap.
    Uses src/recommendation/skill_gap.py and src/recommendation/roadmap.py.
    """
    role = get_role_by_id(role_id_or_name) or get_role_by_name(role_id_or_name)
    if not role:
        return {
            "error": f"Role '{role_id_or_name}' not found in the 60-role catalog.",
            "data_available": False,
        }

    gap = compute_skill_gap(role=role, user_skills=user_skills)
    roadmap = generate_roadmap(role=role, gap=gap)

    return {
        "role_id": role.get("role_id"),
        "role_name": role.get("role_name"),
        "skill_gap": gap,
        "roadmap": roadmap,
        "data_available": True,
    }
