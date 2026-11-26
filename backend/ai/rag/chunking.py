"""
backend/ai/rag/chunking.py
==========================
Structure-aware chunking for controlled hybrid RAG.
STRICT RULE: Index ONLY role descriptions, SHAP driver narratives, and learning resources.
NEVER index raw CSVs or raw feature matrices.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List

from src.recommendation.roadmap import ROLE_FAMILY_PROJECTS, STAGE_ORDER

BASE_DIR = Path(__file__).resolve().parents[3]
CATALOG_PATH = BASE_DIR / "data" / "role_catalog" / "emerging_roles.json"
SHAP_PATH = BASE_DIR / "outputs" / "explanations" / "role_explanations.json"


@dataclass
class RAGChunk:
    chunk_id: str
    text: str
    role_id: str
    role_name: str
    section: str
    source: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _split_into_windows(text: str, target_words: int = 80, overlap_words: int = 15) -> List[str]:
    """Token/word windowing with overlap (~350-450 tokens equivalent to ~60-90 words)."""
    words = text.split()
    if len(words) <= target_words:
        return [text]

    chunks = []
    start = 0
    step = target_words - overlap_words
    while start < len(words):
        window = words[start : start + target_words]
        if window:
            chunks.append(" ".join(window))
        start += step
    return chunks


def load_curated_rag_corpus() -> List[RAGChunk]:
    """
    Load and structure-chunk ONLY:
      1. Role descriptions & requirements (emerging_roles.json)
      2. SHAP market driver narratives (role_explanations.json)
      3. Learning resource descriptions (roadmap projects & stages)
    """
    chunks: List[RAGChunk] = []

    # 1. Role Catalog: Descriptions, Requirements & Gartner Technology Maturity
    from backend.data_loader import load_role_catalog

    catalog = load_role_catalog()
    if catalog:
        for role in catalog:
            role_id = role.get("role_id", "UNKNOWN")
            role_name = role.get("role_name", "Unknown Role")
            family = role.get("role_family", "General IT")
            desc = role.get("role_description", "")
            req_skills = ", ".join(role.get("required_skills", []))
            frontier_skills = ", ".join(role.get("frontier_skills", []))
            hype_stage = role.get("hype_cycle_stage", "Slope of Enlightenment")
            years_to_plat = role.get("years_to_plateau", "2–5 years")
            risk_profile = role.get("career_risk_profile", "Enterprise Scaling (Sweet Spot)")
            rationale = role.get("maturity_rationale", "")

            # Role Overview chunk (with Gartner stage & risk)
            overview_text = (
                f"Role: {role_name} ({role_id}). Family: {family}. "
                f"Classification: {role.get('classification', 'IT Role')}. "
                f"Description: {desc} "
                f"Gartner Hype Cycle Stage: {hype_stage}. "
                f"Years to Plateau: {years_to_plat}. "
                f"Career Risk Profile: {risk_profile}. "
                f"Strategic Maturity Rationale: {rationale}. "
                f"Required Core Skills: {req_skills}. "
                f"Frontier Emerging Skills: {frontier_skills}."
            )
            for i, w in enumerate(_split_into_windows(overview_text, target_words=80, overlap_words=15)):
                chunks.append(
                    RAGChunk(
                        chunk_id=f"{role_id}_overview_{i}",
                        text=w,
                        role_id=role_id,
                        role_name=role_name,
                        section="role_overview",
                        source="emerging_roles.json",
                    )
                )

            # Skill requirements detail chunk
            skill_text = (
                f"Skills for {role_name}: Core mandatory technical skills include {req_skills}. "
                f"Advanced and frontier competencies emerging in market listings include {frontier_skills}."
            )
            chunks.append(
                RAGChunk(
                    chunk_id=f"{role_id}_skills_req",
                    text=skill_text,
                    role_id=role_id,
                    role_name=role_name,
                    section="required_skills",
                    source="emerging_roles.json",
                )
            )

            # Dedicated Gartner Hype Cycle & Career Risk chunk
            maturity_text = (
                f"Gartner Hype Cycle and Career Risk Profile for {role_name} ({role_id}): "
                f"Hype Cycle Stage: {hype_stage}. "
                f"Expected Years to Plateau: {years_to_plat}. "
                f"Career Risk Profile: {risk_profile}. "
                f"Strategic Analysis & Rationale: {rationale} "
                f"This informs whether {role_name} represents speculative hype volatility, an early frontier, or sustainable enterprise scaling."
            )
            chunks.append(
                RAGChunk(
                    chunk_id=f"{role_id}_gartner_maturity",
                    text=maturity_text,
                    role_id=role_id,
                    role_name=role_name,
                    section="gartner_maturity",
                    source="emerging_roles.json",
                )
            )

    # 2. SHAP Market Driver Narratives
    if SHAP_PATH.exists():
        with open(SHAP_PATH, encoding="utf-8") as f:
            shap_data = json.load(f)

        for role_key, exp in shap_data.items():
            role_name = exp.get("role", role_key)
            role_id = role_name.lower().replace(" ", "_").replace("/", "_")

            pos_drivers = exp.get("top_positive_drivers", [])
            pos_desc = "; ".join(
                [f"{d.get('description', d.get('feature'))} ({d.get('direction', '')})" for d in pos_drivers[:4]]
            )

            neg_drivers = exp.get("top_negative_drivers", [])
            neg_desc = "; ".join(
                [f"{d.get('description', d.get('feature'))} ({d.get('direction', '')})" for d in neg_drivers[:4]]
            )

            shap_text = (
                f"Market Demand SHAP Explainability for {role_name}: "
                f"Key factors driving positive market demand growth: {pos_desc}. "
                f"Factors exerting downward or dampening pressure: {neg_desc}."
            )
            chunks.append(
                RAGChunk(
                    chunk_id=f"{role_id}_shap_drivers",
                    text=shap_text,
                    role_id=role_id,
                    role_name=role_name,
                    section="shap_drivers",
                    source="role_explanations.json",
                )
            )

    # 3. Learning Resource & Curriculum Project Descriptions
    stage_names = [s.get("name", str(s)) if isinstance(s, dict) else str(s) for s in STAGE_ORDER]
    for family, projects in ROLE_FAMILY_PROJECTS.items():
        proj_list = "; ".join(projects)
        resource_text = (
            f"Curriculum and Practical Project Recommendations for {family}: "
            f"Key portfolio capstone and applied projects: {proj_list}. "
            f"Structured across standard progressive stages: {', '.join(stage_names)}."
        )
        chunks.append(
            RAGChunk(
                chunk_id=f"family_{family.lower().replace(' ', '_')}_projects",
                text=resource_text,
                role_id="family_curriculum",
                role_name=family,
                section="learning_projects",
                source="roadmap_curriculum",
            )
        )

    # 4. Cleaned, Normalized Job Descriptions from job_listings
    try:
        from backend.database import SessionLocal
        from backend.db_models import JobListing

        with SessionLocal() as db:
            jobs = db.query(JobListing).filter(JobListing.is_active == True).limit(50).all()
            for job in jobs:
                req_s = ", ".join(job.get_required_skills()[:6])
                pref_s = ", ".join(job.get_preferred_skills()[:4])
                job_text = (
                    f"Live Job Opportunity: {job.title} at {job.company}. Location: {job.location} ({job.work_mode}). "
                    f"Experience Level: {job.experience_level}. "
                    f"Required Skills: {req_s}. "
                    f"Preferred Skills: {pref_s}. "
                    f"Application URL: {job.source_url}."
                )
                chunks.append(
                    RAGChunk(
                        chunk_id=f"job_{job.id}",
                        text=job_text,
                        role_id=job.canonical_role_id or "general_job",
                        role_name=job.title,
                        section="job_posting",
                        source="job_listings",
                    )
                )
    except Exception as e:
        # Graceful fallback if SQLite is uninitialized or empty
        pass

    return chunks
