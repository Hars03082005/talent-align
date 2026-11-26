"""
backend/routers/ai_resume.py
============================
FastAPI router for Resume Intelligence Agent.
Endpoints:
  POST /ai/resume/parse: Extracts text via PyMuPDF and parses structured JSON.
  POST /ai/resume/confirm: Saves user-approved skills and profile data to SQLite.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend import db_repository as repo
from backend.ai.agents.resume_agent import (
    ExtractedResumeData,
    extract_text_from_pdf,
    parse_resume_content,
)
from backend.database import get_db
from backend.db_models import User, utc_now

router = APIRouter(prefix="/ai/resume", tags=["AI Resume Intelligence"])


class ResumeConfirmInput(BaseModel):
    user_id: str = Field(..., description="User ID to update")
    skills: List[str] = Field(default_factory=list, description="User-approved skills")
    name: Optional[str] = None
    education: Optional[str] = None
    degree_stream: Optional[str] = None
    experience_level: Optional[str] = None
    experience_years: Optional[float] = None
    projects: Optional[List[Dict[str, Any]]] = None


@router.post("/parse")
async def parse_resume_endpoint(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload and parse resume PDF.
    Extracts structured profile data and normalizes skills against canonical taxonomy.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF format resumes are supported.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    pdf_text = extract_text_from_pdf(content)
    if not pdf_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract readable text from PDF.",
        )

    extracted: ExtractedResumeData = parse_resume_content(pdf_text)

    return {
        "filename": file.filename,
        "extracted_name": extracted.name,
        "email": extracted.email,
        "education": extracted.education,
        "degree_stream": extracted.degree_stream,
        "experience_level": extracted.experience_level,
        "experience_years": extracted.experience_years,
        "extracted_skills": extracted.skills,
        "skills_count": len(extracted.skills),
        "projects": extracted.projects,
        "resume_preview": pdf_text[:400],
    }


@router.post("/confirm")
async def confirm_resume_endpoint(
    payload: ResumeConfirmInput, db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Save user-approved extracted skills and profile data to SQLite."""
    user = repo.get_user(db, payload.user_id)
    if not user:
        # Create user if not found
        user = repo.get_or_create_user(
            db=db,
            user_id=payload.user_id,
            name=payload.name or "Candidate",
            education=payload.education or "",
            degree_stream=payload.degree_stream or "",
            experience_level=payload.experience_level or "Entry Level",
            declared_skills=payload.skills,
        )
    else:
        # Update existing profile
        if payload.name:
            user.name = payload.name
        if payload.education:
            user.education = payload.education
        if payload.degree_stream:
            user.degree_stream = payload.degree_stream
        if payload.experience_level:
            user.experience_level = payload.experience_level
        if payload.experience_years is not None:
            user.experience_years = payload.experience_years
        if payload.skills:
            user.set_declared_skills(payload.skills)
        if payload.projects is not None:
            user.projects = json.dumps(payload.projects)
        user.updated_at = utc_now()
        db.commit()
        db.refresh(user)

    return {
        "status": "confirmed",
        "user_id": user.id,
        "name": user.name,
        "declared_skills": user.get_declared_skills(),
        "skills_count": len(user.get_declared_skills()),
    }
