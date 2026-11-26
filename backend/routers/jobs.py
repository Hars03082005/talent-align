"""
backend/routers/jobs.py
========================
FastAPI Router for Daily Job Intelligence.
Endpoints:
  - GET /jobs/search: Multi-filter job search with deterministic match scoring
  - POST /jobs/refresh: Trigger immediate collection and deduplication run
  - POST /jobs/save: Track job status (saved, applied, shortlisted, rejected)
  - GET /jobs/saved/{user_id}: Retrieve user's tracked job applications
  - GET /jobs/runs: Retrieve collection run logs for "Last synced" timestamp
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import db_repository as repo
from backend.jobs.collector import run_job_collection
from backend.jobs.matcher import compute_job_match

router = APIRouter(prefix="/jobs", tags=["Daily Job Intelligence"])


class JobSaveRequest(BaseModel):
    user_id: str
    job_id: str
    status: str = Field(default="saved", description="saved, applied, shortlisted, rejected")


@router.get("/search")
async def search_jobs_endpoint(
    role_id: Optional[str] = Query(default=None),
    location: Optional[str] = Query(default=None),
    experience: Optional[str] = Query(default=None),
    work_mode: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Search job listings with deterministic match calculation for user profile."""
    # 1. Fetch filtered jobs
    jobs = repo.search_job_listings(
        db,
        role_id=role_id,
        location=location,
        experience_level=experience,
        work_mode=work_mode,
        limit=limit,
    )

    # If no jobs found, ensure seed data exists
    if not jobs:
        from backend.jobs.collector import seed_curated_jobs
        seed_curated_jobs(db)
        jobs = repo.search_job_listings(
            db,
            role_id=role_id,
            location=location,
            experience_level=experience,
            work_mode=work_mode,
            limit=limit,
        )

    # 2. Get user profile for match score calculation
    candidate_profile = {}
    if user_id:
        user = repo.get_user(db, user_id)
        if user:
            candidate_profile = {
                "declared_skills": user.get_declared_skills(),
                "experience_level": user.experience_level,
                "work_mode_preference": user.work_mode_preference,
                "target_roles": user.get_target_roles() if hasattr(user, "get_target_roles") else [],
            }

    # 3. Format and compute deterministic match scores
    formatted_jobs = []
    for j in jobs:
        item = j.to_detail_dict()
        if candidate_profile and candidate_profile.get("declared_skills"):
            match_res = compute_job_match(candidate_profile, item)
            item["match_score"] = match_res["match_score"]
            item["matching_skills"] = match_res["matched_skills"]
            item["missing_skills"] = match_res["missing_skills"]
        else:
            item["match_score"] = 78.0  # sensible default baseline when anonymous
            item["matching_skills"] = item.get("required_skills", [])[:2]
            item["missing_skills"] = item.get("required_skills", [])[2:]

        formatted_jobs.append(item)

    # Sort by match score descending
    formatted_jobs.sort(key=lambda x: x.get("match_score", 0), reverse=True)

    return {
        "total": len(formatted_jobs),
        "jobs": formatted_jobs,
    }


@router.post("/refresh")
async def refresh_jobs_endpoint(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Trigger immediate job collection and deduplication run."""
    summary = run_job_collection(db)
    return {
        "status": "success",
        "summary": summary,
    }


@router.post("/save")
async def save_job_status_endpoint(
    payload: JobSaveRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Save or update job application status (saved, applied, etc.)."""
    app = repo.save_or_update_job_application(
        db,
        user_id=payload.user_id,
        job_id=payload.job_id,
        status=payload.status,
    )
    return {
        "status": "success",
        "application": app.to_dict(),
    }


@router.get("/saved/{user_id}")
async def get_saved_jobs_endpoint(
    user_id: str,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve all tracked job applications for a user."""
    return repo.get_user_job_applications(db, user_id=user_id)


@router.get("/runs")
async def get_job_collection_runs_endpoint(
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve recent collection runs for sync timestamp display."""
    runs = repo.get_latest_job_collection_runs(db, limit=5)
    return [r.to_dict() for r in runs]
