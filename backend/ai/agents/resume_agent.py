"""
backend/ai/agents/resume_agent.py
=================================
Resume Intelligence Agent using PyMuPDF (fitz) text extraction,
Qwen structured JSON parsing, and canonical skill taxonomy normalization.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import fitz  # PyMuPDF
import pandas as pd
from pydantic import BaseModel, Field

from backend.ai.llm_router import _call_ollama
from backend.ai.model_config import GENERATOR_MODEL, OLLAMA_TIMEOUT

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[3]
CANONICAL_SKILLS_PATH = BASE_DIR / "data" / "mappings" / "canonical_skills.csv"
SKILL_MAPPING_PATH = BASE_DIR / "data" / "mappings" / "skill_mapping.csv"
ROLE_SKILL_EVIDENCE_PATH = BASE_DIR / "data" / "06_model_ready" / "role_skill_evidence.csv"
SKILL_INTELLIGENCE_PATH = BASE_DIR / "data" / "role_skill_intelligence.csv"

# Noise words, section headers, degree abbreviations, job titles, and general stopwords to NEVER extract as skills
NOISE_WORDS: Set[str] = {
    "education", "experience", "summary", "projects", "certifications", "certification",
    "skills", "technical skills", "profile", "contact", "b.tech", "btech", "m.tech", "mtech",
    "b.e.", "be", "b.s.", "bs", "m.s.", "ms", "bca", "mca", "phd", "degree", "university",
    "college", "school", "institute", "bangalore", "bengaluru", "hyderabad", "pune", "mumbai",
    "delhi", "noida", "gurgaon", "chennai", "india", "remote", "date", "dates", "year", "years",
    "month", "months", "cgpa", "gpa", "percentage", "present", "current", "candidate", "resume",
    "curriculum", "vitae", "cv", "computer science", "information technology", "engineering",
    "bachelor", "master", "doctorate", "diploma", "coursework", "activities", "awards", "honors",
    "academic", "languages", "english", "hindi", "communication", "leadership", "teamwork",
    "problem solving", "interests", "hobbies", "personal details", "declaration", "about me",
    "engineer", "developer", "architect", "specialist", "analyst", "manager", "lead", "consultant", "intern",
}

# Known modern IT tech whitelist to ensure frontier & developer stack skills are preserved
KNOWN_TECH_WHITELIST: Dict[str, str] = {
    "fastapi": "FastAPI",
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "python": "Python",
    "react": "React",
    "react.js": "React",
    "typescript": "TypeScript",
    "javascript": "JavaScript",
    "node.js": "Node.js",
    "nodejs": "Node.js",
    "sql": "SQL",
    "postgresql": "PostgreSQL",
    "postgres": "PostgreSQL",
    "mongodb": "MongoDB",
    "redis": "Redis",
    "git": "Git",
    "github": "GitHub",
    "aws": "AWS",
    "azure": "Azure",
    "gcp": "GCP",
    "google cloud": "GCP",
    "pytorch": "PyTorch",
    "tensorflow": "TensorFlow",
    "scikit-learn": "Scikit-Learn",
    "sklearn": "Scikit-Learn",
    "pandas": "Pandas",
    "numpy": "NumPy",
    "langchain": "LangChain",
    "langgraph": "LangGraph",
    "ollama": "Ollama",
    "huggingface": "Hugging Face",
    "faiss": "FAISS",
    "rag": "RAG",
    "mlops": "MLOps",
    "ci/cd": "CI/CD",
    "graphql": "GraphQL",
    "rest api": "REST APIs",
    "restful apis": "REST APIs",
    "linux": "Linux",
    "c++": "C++",
    "c#": "C#",
    "java": "Java",
    "golang": "Go",
    "go": "Go",
    "rust": "Rust",
    "kafka": "Kafka",
    "spark": "Apache Spark",
    "airflow": "Apache Airflow",
    "terraform": "Terraform",
    "ansible": "Ansible",
    "helm": "Helm",
    "prometheus": "Prometheus",
    "grafana": "Grafana",
    "vector db": "Vector Databases",
    "vector databases": "Vector Databases",
    "chromadb": "ChromaDB",
    "pinecone": "Pinecone",
    "qdrant": "Qdrant",
}


class ExtractedResumeData(BaseModel):
    name: Optional[str] = Field(default=None, description="Candidate name")
    email: Optional[str] = Field(default=None, description="Email address")
    education: Optional[str] = Field(default=None, description="Highest degree or university")
    degree_stream: Optional[str] = Field(default=None, description="Field of study or major")
    experience_level: str = Field(default="Entry Level", description="Entry Level, Mid Level, Senior")
    experience_years: float = Field(default=0.0, description="Estimated years of experience")
    skills: List[str] = Field(default_factory=list, description="Extracted technical and domain skills")
    projects: List[Dict[str, Any]] = Field(default_factory=list, description="List of notable projects")


class SkillNormalizer:
    """Normalizes raw extracted skill strings strictly against verified skill taxonomy."""

    def __init__(self) -> None:
        self.canonical_map: Dict[str, str] = {}
        self.known_skills: Set[str] = set()
        self._load_taxonomy()

    def _load_taxonomy(self) -> None:
        # 1. Load canonical skills
        if CANONICAL_SKILLS_PATH.exists():
            try:
                df = pd.read_csv(CANONICAL_SKILLS_PATH)
                for _, row in df.iterrows():
                    c_name = str(row.get("canonical_skill_name", "")).strip()
                    if c_name and c_name.lower() not in NOISE_WORDS:
                        self.canonical_map[c_name.lower()] = c_name
                        self.known_skills.add(c_name.lower())
            except Exception as e:
                logger.warning(f"Error loading canonical_skills.csv: {e}")

        # 2. Load skill_mapping.csv
        if SKILL_MAPPING_PATH.exists():
            try:
                df_map = pd.read_csv(SKILL_MAPPING_PATH)
                for _, row in df_map.iterrows():
                    c_skill = str(row.get("canonical_skill", "")).strip()
                    orig_skill = str(row.get("original_skill", "")).strip()
                    if c_skill and c_skill.lower() not in NOISE_WORDS:
                        self.canonical_map[c_skill.lower()] = c_skill
                        self.known_skills.add(c_skill.lower())
                    if orig_skill and orig_skill.lower() not in NOISE_WORDS and c_skill:
                        self.canonical_map[orig_skill.lower()] = c_skill
                        self.known_skills.add(orig_skill.lower())
            except Exception as e:
                logger.warning(f"Error loading skill_mapping.csv: {e}")

        # 3. Load role_skill_evidence.csv
        if ROLE_SKILL_EVIDENCE_PATH.exists():
            try:
                df_ev = pd.read_csv(ROLE_SKILL_EVIDENCE_PATH)
                for _, row in df_ev.iterrows():
                    ev_skill = str(row.get("canonical_skill", "")).strip()
                    if ev_skill and ev_skill.lower() not in NOISE_WORDS:
                        self.canonical_map[ev_skill.lower()] = ev_skill
                        self.known_skills.add(ev_skill.lower())
            except Exception as e:
                logger.warning(f"Error loading role_skill_evidence.csv: {e}")

        # 4. Load role_skill_intelligence.csv
        if SKILL_INTELLIGENCE_PATH.exists():
            try:
                df2 = pd.read_csv(SKILL_INTELLIGENCE_PATH)
                for _, row in df2.iterrows():
                    s_name = str(row.get("skill", "")).strip()
                    if s_name and s_name.lower() not in NOISE_WORDS:
                        self.canonical_map[s_name.lower()] = s_name
                        self.known_skills.add(s_name.lower())
            except Exception as e:
                logger.warning(f"Error loading role_skill_intelligence.csv: {e}")

        # 5. Add tech whitelist to canonical mapping
        for k, v in KNOWN_TECH_WHITELIST.items():
            if k not in NOISE_WORDS:
                self.canonical_map[k] = v
                self.known_skills.add(k)

    def normalize(self, raw_skills: List[str]) -> List[str]:
        """
        Normalize and deduplicate extracted skills.
        Strict rule: drops any token that is a noise word or absent from the canonical taxonomy / whitelist.
        """
        normalized: List[str] = []
        seen = set()

        for s in raw_skills:
            clean = s.strip()
            key = clean.lower()
            if not clean or key in NOISE_WORDS or len(key) < 2:
                continue

            # Direct dictionary lookup
            if key in self.canonical_map:
                std_skill = self.canonical_map[key]
            else:
                # Substring matching against known skills with minimum length
                matched = None
                for k, canonical in self.canonical_map.items():
                    if k not in NOISE_WORDS and len(k) >= 3:
                        if key.startswith(k) or (len(k) >= 4 and k in key):
                            matched = canonical
                            break
                if matched:
                    std_skill = matched
                else:
                    # Strict drop: token is not in canonical taxonomy or whitelist
                    continue

            if std_skill.lower() not in seen and std_skill.lower() not in NOISE_WORDS:
                seen.add(std_skill.lower())
                normalized.append(std_skill)

        return sorted(normalized)


_NORMALIZER = SkillNormalizer()


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract clean text page by page using PyMuPDF (fitz) with fallback."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text_parts = []
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text_parts.append(page.get_text())
        doc.close()
        return "\n".join(text_parts).strip()
    except Exception as e:
        logger.warning(f"PyMuPDF failed ({e}), attempting pypdf fallback...")
        try:
            import io
            import pypdf

            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            text = "\n".join([page.extract_text() or "" for page in reader.pages])
            return text.strip()
        except Exception as e2:
            logger.error(f"Failed to extract PDF text with all extractors: {e2}")
            return ""


def parse_resume_content(pdf_text: str) -> ExtractedResumeData:
    """
    Extract structured candidate data from resume text using Qwen structured JSON,
    with deterministic fallback heuristic.
    Strictly filters out non-skill section headers, degree titles, and noise words.
    """
    if not pdf_text:
        return ExtractedResumeData()

    system_prompt = (
        "You are an expert Technical Resume Information Extraction AI.\n"
        "Analyze the provided resume text and output a STRICT JSON object matching this schema:\n"
        "{\n"
        '  "name": "<full_name_or_null>",\n'
        '  "education": "<highest_degree_and_institution_or_null>",\n'
        '  "degree_stream": "<field_of_study_or_null>",\n'
        '  "experience_level": "<Entry Level | Mid Level | Senior>",\n'
        '  "experience_years": <float_number>,\n'
        '  "technical_skills": ["<skill1>", "<skill2>", ...],\n'
        '  "projects": [{"title": "<project_title>", "description": "<summary>", "skills_used": ["<skill>"]}]\n'
        "}\n\n"
        "CRITICAL EXTRACTION RULES:\n"
        "1. In 'technical_skills', extract ONLY real technical tools, programming languages, frameworks, cloud/devops tools, and databases.\n"
        "2. NEVER include section headers, degree titles, degree names, universities, job titles, or noise words (such as 'Education', 'B.Tech', 'Experience', 'Projects', 'Summary', 'Certifications', 'B.E.', 'M.Tech', 'Degree') in 'technical_skills'.\n"
        "3. Output ONLY valid JSON."
    )

    truncated_text = pdf_text[:4000]
    prompt = f"Resume Text:\n{truncated_text}\n\nStrict JSON Output:"

    raw_json = _call_ollama(
        model=GENERATOR_MODEL,
        prompt=prompt,
        system=system_prompt,
        json_format=True,
        timeout=OLLAMA_TIMEOUT,
    )

    if raw_json:
        try:
            parsed = json.loads(raw_json)
            # Accept either technical_skills or skills
            raw_skills = parsed.get("technical_skills") or parsed.get("skills") or []
            parsed["skills"] = _NORMALIZER.normalize(raw_skills)
            extracted = ExtractedResumeData(**parsed)
            return extracted
        except Exception as e:
            logger.warning(f"Error parsing Ollama resume JSON: {e}")

    # Deterministic fallback parsing
    return _heuristic_resume_fallback(pdf_text)


def _heuristic_resume_fallback(text: str) -> ExtractedResumeData:
    """Deterministic fallback parsing when LLM is unavailable."""
    # Email extraction
    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text)
    email = email_match.group(0) if email_match else None

    # Name extraction (first non-empty line)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    name = lines[0] if lines else "Candidate"
    if len(name) > 40 or "@" in name:
        name = "Candidate"

    # Education heuristic
    education = "Bachelor of Science / Technology"
    if "master" in text.lower() or "m.s." in text.lower() or "m.tech" in text.lower():
        education = "Master of Science / Technology"
    elif "phd" in text.lower() or "doctor" in text.lower():
        education = "Ph.D."
    elif "b.tech" in text.lower() or "btech" in text.lower():
        education = "B.Tech Computer Science"

    # Experience years
    exp_years = 1.0
    exp_match = re.search(r"(\d+(?:\.\d+)?)\+?\s*years?\s*(?:of)?\s*experience", text, re.IGNORECASE)
    if exp_match:
        try:
            exp_years = float(exp_match.group(1))
        except ValueError:
            pass

    exp_level = "Entry Level"
    if exp_years >= 5.0:
        exp_level = "Senior"
    elif exp_years >= 2.0:
        exp_level = "Mid Level"

    # Skill extraction: check text against canonical taxonomy using strict word boundaries
    detected_skills: List[str] = []
    text_lower = text.lower()

    # Prioritize scanning dedicated skills section if present
    skills_sec_match = re.search(r"(?:technical\s+)?skills\s*[:\-]\s*(.*?)(?:\n\n|\n[A-Z][a-zA-Z\s]+:|$)", text, re.IGNORECASE | re.DOTALL)
    search_text = skills_sec_match.group(1).lower() if skills_sec_match else text_lower

    for k, canonical in _NORMALIZER.canonical_map.items():
        if k in NOISE_WORDS or len(k) < 2:
            continue
        pattern = r"\b" + re.escape(k) + r"\b"
        if re.search(pattern, search_text):
            detected_skills.append(canonical)

    # If nothing detected in dedicated section, scan the whole text
    if not detected_skills and skills_sec_match:
        for k, canonical in _NORMALIZER.canonical_map.items():
            if k in NOISE_WORDS or len(k) < 2:
                continue
            pattern = r"\b" + re.escape(k) + r"\b"
            if re.search(pattern, text_lower):
                detected_skills.append(canonical)

    normalized_skills = _NORMALIZER.normalize(detected_skills)

    return ExtractedResumeData(
        name=name,
        email=email,
        education=education,
        degree_stream="Computer Science / IT",
        experience_level=exp_level,
        experience_years=exp_years,
        skills=normalized_skills,
        projects=[],
    )
