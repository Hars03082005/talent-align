"""
backend/services/resume_service.py
==================================
Extracts structured candidate data from uploaded PDF resumes.
Extracts name, email, education, technical skills, projects, and experience years.
Enforces human review: returns extracted draft for candidate approval before persisting.
"""

from __future__ import annotations

import io
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import pypdf

from backend.models import ResumeUploadResponse
from backend.services.job_service import extract_skills_from_text

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract plain text from PDF bytes using pypdf."""
    text_content = []
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text_content.append(t)
    except Exception as e:
        logger.error(f"Error reading PDF with pypdf: {e}")
        # Try raw utf-8 decoding fallback
        try:
            return file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            return ""

    return "\n".join(text_content)


def parse_resume_content(filename: str, file_bytes: bytes) -> ResumeUploadResponse:
    """
    Parse uploaded resume document and extract key candidate profile attributes.
    """
    raw_text = extract_text_from_pdf(file_bytes)
    if not raw_text.strip():
        # Fallback text
        return ResumeUploadResponse(
            success=False,
            filename=filename,
            raw_text_preview="Unable to extract text from document. Please ensure PDF contains selectable text.",
        )

    # 1. Extract Email
    email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", raw_text)
    email = email_match.group(0) if email_match else None

    # 2. Extract Name (heuristic: first non-empty line with 2-4 words)
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    candidate_name = None
    for line in lines[:5]:
        words = line.split()
        if 2 <= len(words) <= 4 and not any(char in line for char in ["@", "http", ".com", "resume", "cv", "page"]):
            candidate_name = line
            break

    # 3. Extract Skills using domain taxonomy
    extracted_skills = extract_skills_from_text(raw_text)

    # 4. Extract Education
    education = "Bachelor of Science / Technology"
    stream = "Computer Science & Engineering"
    raw_lower = raw_text.lower()
    if "master" in raw_lower or "m.tech" in raw_lower or "ms " in raw_lower:
        education = "Master of Science / Technology"
    elif "phd" in raw_lower or "doctorate" in raw_lower:
        education = "Doctorate / Ph.D."
    elif "bachelor" in raw_lower or "b.tech" in raw_lower or "b.e" in raw_lower or "bs " in raw_lower:
        education = "Bachelor of Technology / Science"

    if "data" in raw_lower:
        stream = "Data Science & Analytics"
    elif "artificial intelligence" in raw_lower or "machine learning" in raw_lower:
        stream = "AI & Machine Learning"
    elif "information" in raw_lower or "it" in raw_lower:
        stream = "Information Technology"

    # 5. Estimate Experience Years
    exp_years = 1.0  # default entry/early-career
    years_found = re.findall(r"(\d+)\+?\s*years?(?:\s+of)?\s+experience", raw_lower)
    if years_found:
        try:
            exp_years = float(years_found[0])
        except Exception:
            pass
    elif any(term in raw_lower for term in ["intern", "graduating", "student", "fresh graduate", "fresher"]):
        exp_years = 0.5
    elif any(term in raw_lower for term in ["senior", "lead", "architect"]):
        exp_years = 5.0

    # 6. Extract Project Titles
    projects = []
    project_headers = ["projects", "personal projects", "academic projects", "key projects"]
    in_projects = False
    for line in lines:
        if any(h in line.lower() for h in project_headers):
            in_projects = True
            continue
        if in_projects and any(h in line.lower() for h in ["experience", "education", "skills", "certifications", "awards"]):
            break
        if in_projects and len(line) > 5 and len(line) < 80 and not line.startswith("•"):
            projects.append({
                "title": line.strip(" -:*#"),
                "description": "Extracted from candidate resume.",
                "skills_used": [s for s in extracted_skills[:3]],
            })
            if len(projects) >= 3:
                break

    return ResumeUploadResponse(
        success=True,
        filename=filename,
        extracted_name=candidate_name,
        extracted_email=email,
        extracted_skills=extracted_skills,
        extracted_education=f"{education} ({stream})",
        extracted_experience_years=exp_years,
        extracted_projects=projects,
        raw_text_preview=raw_text[:600] + ("..." if len(raw_text) > 600 else ""),
    )
