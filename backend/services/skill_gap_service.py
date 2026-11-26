"""
backend/services/skill_gap_service.py
=====================================
Analyzes market-wide and job-specific skill gaps for candidates.
Compares candidate capabilities against actual employer job requirements.
Categorizes into: Already Possessed, Needs Improvement, and Missing.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Set

from sqlalchemy.orm import Session

from backend.db_models import JobListing, User
from backend.models import MissingSkillItem, SkillGapMarketResponse

logger = logging.getLogger(__name__)


def compute_market_skill_gap(
    db: Session,
    user: User,
    target_role: Optional[str] = None,
    limit_jobs: int = 40,
) -> SkillGapMarketResponse:
    """
    Computes aggregated market skill gap by analyzing the top matching or target job postings.
    """
    user_skills_raw = user.get_declared_skills()
    user_skills_lower = {s.strip().lower() for s in user_skills_raw if s.strip()}

    # Select target jobs
    q = db.query(JobListing).filter(JobListing.is_active == 1)
    target_roles = user.get_target_roles()
    if target_role:
        target_roles = [target_role]

    if target_roles:
        target_term = f"%{target_roles[0].strip()}%"
        q = q.filter(
            (JobListing.title.ilike(target_term))
            | (JobListing.normalized_title.ilike(target_term))
            | (JobListing.description.ilike(target_term))
        )

    jobs = q.limit(limit_jobs).all()
    if not jobs:
        jobs = db.query(JobListing).filter(JobListing.is_active == 1).limit(limit_jobs).all()

    total_jobs = max(1, len(jobs))

    # Frequency analysis
    missing_freq: Dict[str, Dict[str, Any]] = {}
    possessed_set: Set[str] = set()

    for job in jobs:
        req_skills = job.get_required_skills() + job.get_preferred_skills()
        for s in req_skills:
            s_clean = s.strip()
            s_lower = s_clean.lower()
            if s_lower in user_skills_lower or any(us in s_lower or s_lower in us for us in user_skills_lower):
                possessed_set.add(s_clean)
            else:
                if s_clean not in missing_freq:
                    missing_freq[s_clean] = {
                        "count": 0,
                        "sample_jobs": [],
                    }
                missing_freq[s_clean]["count"] += 1
                if len(missing_freq[s_clean]["sample_jobs"]) < 2:
                    missing_freq[s_clean]["sample_jobs"].append(f"{job.title} at {job.company}")

    # Build missing skills list with importance rating
    missing_items: List[MissingSkillItem] = []
    for skill_name, data in sorted(missing_freq.items(), key=lambda x: x[1]["count"], reverse=True):
        count = data["count"]
        pct = round((count / total_jobs) * 100.0, 1)
        if pct >= 50.0:
            importance = "Critical"
        elif pct >= 25.0:
            importance = "High"
        else:
            importance = "Moderate"

        missing_items.append(
            MissingSkillItem(
                skill=skill_name,
                frequency_in_jobs=count,
                frequency_pct=pct,
                importance=importance,
                sample_jobs=data["sample_jobs"],
            )
        )

    # Needs improvement: candidate has declared skills that appear in target jobs but require higher velocity
    needs_improvement = [s for s in possessed_set if any(sub in s.lower() for sub in ["cloud", "docker", "kubernetes", "aws", "sql", "system design"])]

    return SkillGapMarketResponse(
        possessed_skills=sorted(list(possessed_set)),
        needs_improvement_skills=sorted(needs_improvement),
        missing_skills=missing_items[:25],
        total_target_jobs_analyzed=total_jobs,
        target_roles=target_roles,
    )
