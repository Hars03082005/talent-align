"""
backend/jobs/matcher.py
========================
Deterministic Job Matching Engine.
STRICT RULE: Match scores are computed via pure Python arithmetic — NEVER by an LLM.

Weights:
  - Required skill compatibility: 40%
  - Role/title relevance:         25%
  - Experience compatibility:     15%
  - Location/work preference:     10%
  - Preferred skill compatibility: 10%
Total: 100%
"""

from __future__ import annotations

from typing import Any, Dict, List, Set, Tuple


def _normalize_set(skills: List[str]) -> Set[str]:
    return {s.strip().lower() for s in skills if s and s.strip()}


def compute_job_match(
    candidate_profile: Dict[str, Any],
    job: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Compute deterministic multi-factor match score between candidate and job listing.
    Returns:
      {
        "match_score": float (0-100),
        "matched_skills": List[str],
        "missing_skills": List[str],
        "breakdown": Dict[str, float]
      }
    """
    cand_skills_raw = candidate_profile.get("declared_skills") or []
    cand_skills = _normalize_set(cand_skills_raw)

    req_skills_raw = job.get("required_skills") or []
    pref_skills_raw = job.get("preferred_skills") or []

    # 1. Required Skill Compatibility (40%)
    matched_req: List[str] = []
    missing_req: List[str] = []
    for s in req_skills_raw:
        if s.strip().lower() in cand_skills:
            matched_req.append(s)
        else:
            missing_req.append(s)

    if req_skills_raw:
        req_score = len(matched_req) / len(req_skills_raw)
    else:
        req_score = 0.85  # default baseline if no explicit skills specified

    # 2. Preferred Skill Compatibility (10%)
    matched_pref: List[str] = []
    for s in pref_skills_raw:
        if s.strip().lower() in cand_skills:
            matched_pref.append(s)

    if pref_skills_raw:
        pref_score = len(matched_pref) / len(pref_skills_raw)
    else:
        pref_score = 0.50

    # 3. Role/Title Relevance (25%)
    cand_roles = {r.strip().lower() for r in (candidate_profile.get("target_roles") or [])}
    title = (job.get("title") or "").strip().lower()
    canonical_id = job.get("canonical_role_id") or ""

    title_score = 0.40  # baseline
    if any(cr in title or title in cr for cr in cand_roles):
        title_score = 1.0
    elif any(cr in title for cr in ["engineer", "developer", "architect", "analyst"]):
        title_score = 0.70

    # 4. Experience Compatibility (15%)
    cand_exp_level = (candidate_profile.get("experience_level") or "Mid Level").strip().lower()
    job_exp_level = (job.get("experience_level") or "Mid Level").strip().lower()

    if cand_exp_level in job_exp_level or job_exp_level in cand_exp_level:
        exp_score = 1.0
    elif "entry" in cand_exp_level and ("entry" in job_exp_level or "1-3" in job_exp_level):
        exp_score = 1.0
    elif "senior" in cand_exp_level and "senior" in job_exp_level:
        exp_score = 1.0
    else:
        exp_score = 0.60

    # 5. Location / Work Mode Preference (10%)
    cand_mode = (candidate_profile.get("work_mode_preference") or "remote").strip().lower()
    job_mode = (job.get("work_mode") or job.get("location_type") or "remote").strip().lower()

    if cand_mode in job_mode or job_mode in cand_mode or "remote" in job_mode:
        loc_score = 1.0
    else:
        loc_score = 0.50

    # Weighted Sum
    total_score = (
        (req_score * 40.0)
        + (title_score * 25.0)
        + (exp_score * 15.0)
        + (loc_score * 10.0)
        + (pref_score * 10.0)
    )

    final_score = round(max(0.0, min(100.0, total_score)), 1)

    return {
        "match_score": final_score,
        "matched_skills": list(dict.fromkeys(matched_req + matched_pref)),
        "missing_skills": missing_req,
        "breakdown": {
            "required_skills": round(req_score * 40.0, 1),
            "title_relevance": round(title_score * 25.0, 1),
            "experience": round(exp_score * 15.0, 1),
            "location_mode": round(loc_score * 10.0, 1),
            "preferred_skills": round(pref_score * 10.0, 1),
        },
    }
