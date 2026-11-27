"""Export the existing Python role policy and research assets for the hosted workspace."""

from __future__ import annotations

import csv
import json
from itertools import permutations
from pathlib import Path

from backend.data_loader import load_role_catalog
from backend.questionnaire_engine import ARCHETYPE_NAMES, QuestionnaireEngine
from backend.services.job_service import SKILL_ALIASES
from src.recommendation.profile_engine import ARCHETYPE_DESCRIPTIONS, QUESTION_INTEREST_MAP, WORK_STYLE_ANSWER_MAP
from src.recommendation.roadmap import DEFAULT_PROJECTS, ROLE_FAMILY_PROJECTS, STAGE_ORDER
from src.recommendation.role_matcher import (
    REC_CFG,
    _get_role_baio_vector,
    _score_baio_fit,
    _score_emergence_signal,
    _score_future_opportunity,
)

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "frontend" / "src" / "workspace"


def build_export() -> dict:
    roles = []
    for source in load_role_catalog():
        role = dict(source)
        role["signals"] = {
            "baio_fit": _score_baio_fit({}, source),
            "baio_vector": _get_role_baio_vector(source).tolist(),
            "future_opportunity": _score_future_opportunity(source),
            "emergence_signal": _score_emergence_signal(source),
        }
        roles.append(role)
    if not roles:
        raise ValueError("Repository role catalog is empty")
    aliases = dict(SKILL_ALIASES)
    aliases.update({
        "amazon web services (aws)": "AWS",
        "google cloud platform (gcp)": "Google Cloud",
        "large language models": "LLMs",
        "large language model": "LLMs",
        "retrieval-augmented generation": "RAG",
        "retrieval augmented generation": "RAG",
        "continuous integration": "CI/CD",
        "rest apis": "REST APIs",
        "github actions": "GitHub Actions",
        "go programming": "Go",
        "go programming language": "Go",
    })
    # Ambiguous single words and short acronyms in postings require explicit context.
    ambiguous = {
        "node", "py", "ts", "js", "go", "r", "c", "ai", "ml", "cicd", "mls",
        "data", "cloud", "analysis", "knowledge", "service", "development", "testing",
        "agile", "security", "research", "engineer", "scrum", "excel", "firmware",
        "senior", "education", "race", "religion", "gender identity", "national origin",
    }
    feed_skills = (
        "Machine Learning|Deep Learning|Generative AI|RAG|Prompt Engineering|Computer Vision|"
        "Hugging Face|PyTorch|TensorFlow|scikit-learn|LangChain|LangGraph|Vector Databases|"
        "Data Engineering|Data Modeling|Data Pipelines|Apache Airflow|Apache Flink|AWS|"
        "Microsoft Azure|Google Cloud|Terraform|Jenkins|GitHub Actions|CI/CD|Helm|"
        "OpenTelemetry|Prometheus|Grafana|Linux|Spring Boot|Node.js|TypeScript|JavaScript|"
        "REST APIs|gRPC|Selenium|Playwright|JUnit|pytest|FastAPI|Distributed Systems|"
        "Microservices|PostgreSQL|MySQL|MongoDB|Redis|Snowflake|Databricks|dbt|GraphQL|"
        "Kubernetes|Nginx|Docker|Apache Kafka|Kafka|DynamoDB|Tailwind CSS|Bash|"
        "Incident Response|Network Security|Computer Networking|Git|VS Code|HTML|CSS|"
        "Penetration Testing|OWASP|SIEM|Splunk|Vulnerability Management|OAuth|SAML|"
        "LLMs|OpenAI API|Kotlin|Salesforce|MLOps|Model Evaluation|Fine-tuning"
    ).split("|")
    canonical_path = ROOT / "data" / "mappings" / "canonical_skills.csv"
    with canonical_path.open(encoding="utf-8", newline="") as file:
        canonical = [row["canonical_skill_name"] for row in csv.DictReader(file)]
    aliases.update({
        "apache kafka": "Kafka", "kafka": "Kafka", "azure": "Microsoft Azure",
        "restful apis": "REST APIs", "react native": "React Native", "springboot": "Spring Boot",
        "vector database": "Vector Databases", "data pipeline": "Data Pipelines",
    })
    vocabulary = {name.lower(): aliases.get(name.lower(), name) for name in canonical + feed_skills}
    vocabulary.update(aliases)
    with canonical_path.with_name("skill_mapping.csv").open(encoding="utf-8", newline="") as file:
        for row in csv.DictReader(file):
            original = row["original_skill"].strip().lower()
            official = row["canonical_skill"].strip().lower()
            if original and official in vocabulary:
                vocabulary.setdefault(original, vocabulary[official])
                aliases.setdefault(original, vocabulary[official])
    return {
        "roles": roles,
        "policy": {key: REC_CFG[key] for key in ("weights", "interest_category_map", "experience_modifiers", "work_style_map", "output_scores", "recommendation")},
        "vocabulary": {word: canonical for word, canonical in sorted(vocabulary.items()) if word not in ambiguous},
        "aliases": aliases,
        "roadmap": {"stages": STAGE_ORDER, "projects": ROLE_FAMILY_PROJECTS, "defaultProjects": DEFAULT_PROJECTS},
        "referencePeriod": "Nov 2023 – Oct 2025",
    }


def build_assessment_export() -> dict:
    engine = QuestionnaireEngine(ROOT / "backend" / "questionnaire.json")
    first = engine.stage1_question_ids()
    initial_ids = set(first)
    branches = {}
    for top in permutations(range(len(ARCHETYPE_NAMES)), 3):
        # The adaptive pools are phase-disjoint. Until each branch executes,
        # no questions in its phase have been asked.
        branches["".join(map(str, top))] = {
            "adaptive": engine.stage2_question_ids(top, initial_ids),
            "reconfirmation": engine.stage3_question_ids(top, initial_ids),
        }
    return {
        "first": first,
        "total": 20,
        "branches": branches,
        "archetypes": ARCHETYPE_NAMES,
        "descriptions": ARCHETYPE_DESCRIPTIONS,
        "interestPrefixes": list(QUESTION_INTEREST_MAP.items()),
        "workStyleKeywords": WORK_STYLE_ANSWER_MAP,
    }


def main() -> None:
    for name, asset in (("catalog", build_export()), ("assessment", build_assessment_export())):
        destination = WORKSPACE / f"{name}.generated.json"
        destination.write_text(json.dumps(asset, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
        print("Exported", destination.relative_to(ROOT))


if __name__ == "__main__":
    main()
