"""
backend/services/matching_service.py
====================================
Transparent, deterministic candidate-to-job compatibility matching engine.
Evaluates technical skills, experience, education, role alignment, and location compatibility.
Produces detailed explanations, matching/missing skills, and improvement actions.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from backend.db_models import JobListing, User
from backend.models import CompatibilityBreakdown, JobListingSummary

logger = logging.getLogger(__name__)


def calculate_job_compatibility(user: User, job: JobListing) -> CompatibilityBreakdown:
    """
    Calculate transparent multi-dimensional compatibility score [0..100]
    between a candidate profile and an authentic job listing.
    """
    user_skills = {s.strip().lower() for s in user.get_declared_skills() if s.strip()}
    user_exp_years = float(user.experience_years or 0.0)
    user_roles = [r.strip().lower() for r in user.get_target_roles() if r.strip()]
    user_edu = (user.education or "").lower()
    user_stream = (user.degree_stream or "").lower()
    user_work_mode = (user.work_mode_preference or "any").lower()
    user_locs = [l.strip().lower() for l in user.get_preferred_locations() if l.strip()]

    job_req_skills = [s.strip() for s in job.get_required_skills()]
    job_pref_skills = [s.strip() for s in job.get_preferred_skills()]
    job_title = (job.title or "").lower()
    job_norm_title = (job.normalized_title or "").lower()
    job_loc_type = (job.location_type or "remote").lower()
    job_loc = (job.location or "").lower()
    job_exp_min = float(job.experience_min or 0.0)
    job_exp_max = float(job.experience_max or 5.0)

    # 1. Technical Skills Score (Weight: 40%)
    matching_skills: List[str] = []
    missing_mandatory: List[str] = []
    missing_preferred: List[str] = []

    for s in job_req_skills:
        if s.lower() in user_skills or any(us in s.lower() or s.lower() in us for us in user_skills):
            matching_skills.append(s)
        else:
            missing_mandatory.append(s)

    for s in job_pref_skills:
        if s.lower() in user_skills or any(us in s.lower() or s.lower() in us for us in user_skills):
            if s not in matching_skills:
                matching_skills.append(s)
        else:
            missing_preferred.append(s)

    if job_req_skills:
        skill_score = (len(matching_skills) / max(1, len(job_req_skills))) * 100.0
        # Bonus for preferred skills
        if len(matching_skills) > len(job_req_skills):
            skill_score = min(100.0, skill_score + 5.0)
    else:
        skill_score = 75.0 if user_skills else 50.0
    skill_score = min(100.0, max(0.0, skill_score))

    # 2. Experience Compatibility Score (Weight: 20%)
    if user_exp_years >= job_exp_min:
        if user_exp_years <= job_exp_max + 2.0:
            exp_score = 100.0
        else:
            # Overqualified slightly
            exp_score = 85.0
    else:
        gap = job_exp_min - user_exp_years
        exp_score = max(30.0, 100.0 - (gap * 25.0))

    # 3. Education / Degree Alignment (Weight: 15%)
    edu_score = 70.0  # baseline
    tech_streams = ["computer", "data", "software", "information", "electrical", "math", "statistics", "science", "engineering"]
    if any(ts in user_stream for ts in tech_streams):
        edu_score += 20.0
    if any(ed in user_edu for ed in ["bachelor", "master", "phd", "b.tech", "b.e", "m.tech", "ms"]):
        edu_score += 10.0
    edu_score = min(100.0, edu_score)

    # 4. Role & Career Interest Alignment (Weight: 15%)
    role_score = 50.0  # default moderate alignment
    if user_roles:
        matched_role = False
        for ur in user_roles:
            if ur in job_title or ur in job_norm_title or job_norm_title in ur:
                role_score = 100.0
                matched_role = True
                break
        if not matched_role:
            # Check overlap of words
            role_words = set(job_title.split())
            user_role_words = set(" ".join(user_roles).split())
            common_words = role_words.intersection(user_role_words) - {"and", "of", "in", "engineer", "developer"}
            if common_words:
                role_score = 75.0
            else:
                role_score = 45.0
    elif user_skills:
        role_score = 65.0

    # 5. Location & Work Mode Compatibility (Weight: 10%)
    loc_score = 70.0
    if user_work_mode == "any":
        loc_score = 100.0
    elif user_work_mode == job_loc_type:
        loc_score = 100.0
    elif job_loc_type == "remote":
        loc_score = 95.0
    elif user_locs and any(ul in job_loc for ul in user_locs):
        loc_score = 90.0
    else:
        loc_score = 50.0

    # Overall Composite Score
    overall = (
        0.40 * skill_score
        + 0.20 * exp_score
        + 0.15 * edu_score
        + 0.15 * role_score
        + 0.10 * loc_score
    )
    overall = round(min(100.0, max(0.0, overall)), 1)

    # Generate Grounded Explanations
    why_matched = []
    if matching_skills:
        why_matched.append(f"Strong skill alignment on: {', '.join(matching_skills[:4])}")
    if user_exp_years >= job_exp_min:
        why_matched.append(f"Experience level ({user_exp_years:.1f} yrs) meets the minimum requirement ({job_exp_min:.1f} yrs)")
    if any(ts in user_stream for ts in tech_streams):
        why_matched.append(f"Technical academic background ({user.degree_stream or 'Engineering'}) aligns with employer criteria")
    if job_loc_type == "remote" or user_work_mode in ["any", job_loc_type]:
        why_matched.append(f"Work arrangement ({job.location_type.capitalize()}) matches your work mode preferences")

    how_to_improve = []
    if missing_mandatory:
        top_missing = missing_mandatory[:3]
        how_to_improve.append(f"Acquire missing core requirements: {', '.join(top_missing)}")
    if missing_preferred:
        how_to_improve.append(f"Familiarize with preferred technologies: {', '.join(missing_preferred[:2])}")
    if user_exp_years < job_exp_min:
        gap = job_exp_min - user_exp_years
        how_to_improve.append(f"Build hands-on portfolio projects to demonstrate equivalent {gap:.1f} years of applied expertise")

    return CompatibilityBreakdown(
        overall_score=overall,
        skill_match_score=round(skill_score, 1),
        experience_score=round(exp_score, 1),
        education_score=round(edu_score, 1),
        role_alignment_score=round(role_score, 1),
        location_score=round(loc_score, 1),
        matching_skills=matching_skills,
        missing_mandatory_skills=missing_mandatory,
        missing_preferred_skills=missing_preferred,
        why_matched=why_matched,
        how_to_improve=how_to_improve,
    )


def rank_jobs_for_candidate(
    db: Session,
    user: User,
    limit: int = 50,
) -> List[Tuple[JobListing, CompatibilityBreakdown]]:
    """
    Ranks active job listings for a candidate using multi-factor compatibility scoring.
    Returns sorted list of (JobListing, CompatibilityBreakdown).
    """
    jobs = db.query(JobListing).filter(JobListing.is_active == 1).limit(500).all()

    scored_jobs = []
    for job in jobs:
        breakdown = calculate_job_compatibility(user, job)
        scored_jobs.append((job, breakdown))

    # Sort descending by overall compatibility score
    scored_jobs.sort(key=lambda x: x[1].overall_score, reverse=True)

    return scored_jobs[:limit]
