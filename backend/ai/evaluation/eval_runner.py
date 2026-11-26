"""
backend/ai/evaluation/eval_runner.py
====================================
Comprehensive offline evaluation suite for the TalentAlign AI Layer:
Evaluates:
  1. LangGraph Supervisor Agent Routing Accuracy (4 agents: Career Advisor, Resume Intelligence, Skill Development, Job Intelligence)
  2. Hybrid RAG Retrieval (Hit Rate@5 and Precision@5)
  3. Resume Skill Extraction (Precision, Recall, F1 against ground truth)
  4. Python Validator Hallucination Rejection Rate (target 100%)

Outputs structured metrics to outputs/ai_evaluation_report.json and renders a clean console table.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List

from backend.ai.agents.resume_agent import SkillNormalizer
from backend.ai.graph.workflow import classify_agent_route
from backend.ai.llm_router import classify_intent
from backend.ai.rag.retriever import retrieve_chunks
from backend.ai.validator import validate_ai_response

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("eval_runner")

BASE_DIR = Path(__file__).resolve().parents[3]
OUTPUTS_DIR = BASE_DIR / "outputs"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
REPORT_FILE = OUTPUTS_DIR / "ai_evaluation_report.json"

# ── 1. AGENT ROUTING & RETRIEVAL BENCHMARK ────────────────────────────────────
EVAL_BENCHMARK: List[Dict[str, Any]] = [
    {
        "query": "Compare MLOps Engineer versus Data Engineer career prospects.",
        "expected_agent": "career_advisor",
        "expected_roles": ["MLOps Engineer", "Data Engineer"],
    },
    {
        "query": "Am I qualified for a Cloud Architect role with 3 years Python and AWS experience?",
        "expected_agent": "career_advisor",
        "expected_roles": ["Cloud Architect", "Cloud Infrastructure Engineer"],
    },
    {
        "query": "What is the 12-month demand forecast and growth rate for AI Security Engineer?",
        "expected_agent": "career_advisor",
        "expected_roles": ["AI Security Engineer"],
    },
    {
        "query": "How does Machine Learning Engineer compare to Data Scientist in LightGBM demand?",
        "expected_agent": "career_advisor",
        "expected_roles": ["Machine Learning Engineer", "Data Scientist"],
    },
    {
        "query": "What is driving the market demand for Prompt Engineer according to SHAP feature analysis?",
        "expected_agent": "career_advisor",
        "expected_roles": ["Prompt Engineer"],
    },
    {
        "query": "Please analyze my resume skills and recommend bullet improvements for Senior Software Engineer.",
        "expected_agent": "resume_intelligence",
        "expected_roles": ["Software Engineer"],
    },
    {
        "query": "How can I improve my CV bullet points to target Site Reliability Engineer positions?",
        "expected_agent": "resume_intelligence",
        "expected_roles": ["Site Reliability Engineer (SRE)"],
    },
    {
        "query": "Review my resume experience section and suggest X-Y-Z formula bullets for Backend Engineer.",
        "expected_agent": "resume_intelligence",
        "expected_roles": ["Backend Engineer"],
    },
    {
        "query": "What are the essential skills missing on my profile CV for Quantum Software Engineer?",
        "expected_agent": "resume_intelligence",
        "expected_roles": ["Quantum Software Engineer"],
    },
    {
        "query": "What is the 6-month learning roadmap and recommended capstone projects for Generative AI Engineer?",
        "expected_agent": "skill_development",
        "expected_roles": ["Generative AI Engineer"],
    },
    {
        "query": "What skills do I need to learn to transition from Frontend Developer to Full Stack Engineer?",
        "expected_agent": "skill_development",
        "expected_roles": ["Full Stack Developer", "Software Engineer"],
    },
    {
        "query": "Give me a 3-phase study plan and weekly tasks to master Kubernetes, Terraform, and CI/CD pipelines.",
        "expected_agent": "skill_development",
        "expected_roles": ["Cloud & Infrastructure", "DevOps & Platform Engineering"],
    },
    {
        "query": "Recommend practice portfolio projects to build hands-on skills for AI Agent Engineer.",
        "expected_agent": "skill_development",
        "expected_roles": ["AI Agent / Agentic AI Engineer"],
    },
    {
        "query": "Find open Bengaluru jobs matching my top role and skills.",
        "expected_agent": "job_intelligence",
        "expected_roles": ["Generative AI Engineer", "Software Engineer"],
    },
    {
        "query": "Show me live hiring vacancies and company openings for MLOps Specialist.",
        "expected_agent": "job_intelligence",
        "expected_roles": ["MLOps Specialist", "MLOps Engineer"],
    },
    {
        "query": "Are there remote job listings and positions available for Cloud Infrastructure Engineer?",
        "expected_agent": "job_intelligence",
        "expected_roles": ["Cloud Infrastructure Engineer"],
    },
]

# ── 2. RESUME EXTRACTION BENCHMARK ────────────────────────────────────────────
RESUME_BENCHMARK: List[Dict[str, Any]] = [
    {
        "text": (
            "Education: B.Tech in Computer Science from Bangalore University (2020-2024), CGPA 8.8.\n"
            "Technical Skills: Python, FastAPI, Docker, PostgreSQL, Redis, Git.\n"
            "Experience: Software Engineer Intern working on microservices and REST APIs."
        ),
        "ground_truth": ["Python", "FastAPI", "Docker", "PostgreSQL", "Redis", "Git"],
    },
    {
        "text": (
            "Summary: Senior Developer with 5 years experience in Hyderabad.\n"
            "Core Competencies: Kubernetes, Terraform, AWS, Linux, CI/CD, Prometheus.\n"
            "Projects: Deployed multi-region clusters using Helm and automated Jenkins pipelines."
        ),
        "ground_truth": ["Kubernetes", "Terraform", "AWS", "Linux", "CI/CD"],
    },
    {
        "text": (
            "Certifications: AWS Solutions Architect, Coursera Deep Learning.\n"
            "Skills: PyTorch, Hugging Face, FAISS, LangChain, RAG, NumPy, Pandas.\n"
            "Declaration: I hereby declare that the details provided above are true."
        ),
        "ground_truth": ["PyTorch", "Hugging Face", "FAISS", "LangChain", "RAG", "NumPy", "Pandas"],
    },
]

# ── 3. HALLUCINATION VALIDATOR BENCHMARK ──────────────────────────────────────
VALIDATOR_BENCHMARK = [
    {
        "name": "Hallucinated explosive growth & bps",
        "text": "The role has an explosive growth of 999.8% and +4500 bps demand increase over 6 months.",
        "context": {"forecast_6m_bps": 2.5, "growth_pct_6m": 12.0},
        "citations": ["[LightGBM: Demand Forecast]"],
        "expect_rejection": True,
    },
    {
        "name": "Hallucinated non-catalog role name",
        "text": "You should consider transitioning into Super Galactic Quantum Wizard at Google.",
        "context": {"forecast_6m_bps": 1.0},
        "citations": ["[Role Catalog: ROLE_001]"],
        "expect_rejection": True,
    },
    {
        "name": "Hallucinated 100% fabricated match percentage",
        "text": "Your verified match score is 98% based on our proprietary LightGBM neural assessment.",
        "context": {"match_score": 62.0},
        "citations": ["[ML Tool: Matcher]"],
        "expect_rejection": True,
    },
    {
        "name": "Missing citations in analytical response",
        "text": "The demand forecast is 0.16 bps and the role growth is 13.3%.",
        "context": {"forecast_6m_bps": 0.16, "growth_pct_6m": 13.3},
        "citations": [],
        "expect_rejection": True,
    },
    {
        "name": "Valid strictly grounded response",
        "text": "MLOps Engineer demand is projected at 0.16 bps (+13.3% growth). [Role Catalog: ROLE_1004] [LightGBM: 6M Forecast]",
        "context": {"forecast_6m_bps": 0.16, "growth_pct_6m": 13.3},
        "citations": ["[Role Catalog: ROLE_1004]", "[LightGBM: 6M Forecast]"],
        "expect_rejection": False,
    },
]


def run_offline_evaluation() -> Dict[str, Any]:
    print("=" * 80)
    print("TALENTALIGN AI LAYER OFFLINE EVALUATION BENCHMARK")
    print("=" * 80)

    # 1. Routing Evaluation
    routing_correct = 0
    hit_rate_count = 0
    precision_total_hits = 0
    total_chunks_inspected = 0
    total_queries = len(EVAL_BENCHMARK)

    print("\n--- 1. SUPERVISOR ROUTING & HYBRID RAG RETRIEVAL (16 Queries) ---")
    for i, item in enumerate(EVAL_BENCHMARK, 1):
        q = item["query"]
        exp_agent = item["expected_agent"]
        exp_roles = [r.lower() for r in item["expected_roles"]]

        # Classify routing
        raw_intent = classify_intent(q)
        actual_agent = classify_agent_route(q, raw_intent)
        is_route_ok = actual_agent == exp_agent
        if is_route_ok:
            routing_correct += 1

        # RAG Retrieval
        rag_res = retrieve_chunks(q, top_k=5)
        chunks = rag_res.get("chunks", [])
        retrieved_roles = [str(c.get("role_name", "")).lower() for c in chunks]

        # Calculate Hits and Precision@5
        matched_in_top5 = 0
        for rr in retrieved_roles:
            if any(er in rr or rr in er for er in exp_roles):
                matched_in_top5 += 1

        hit = matched_in_top5 > 0
        if hit:
            hit_rate_count += 1
        precision_total_hits += matched_in_top5
        total_chunks_inspected += max(1, len(chunks))

        route_symbol = "✓" if is_route_ok else "✗"
        hit_symbol = "✓" if hit else "✗"
        print(f"[{i:02d}/16] Route: {route_symbol} ({actual_agent:20s}) | RAG Hit: {hit_symbol} ({matched_in_top5}/5) | {q[:42]}...")

    routing_accuracy = round((routing_correct / total_queries) * 100, 1)
    retrieval_hit_rate = round((hit_rate_count / total_queries) * 100, 1)
    retrieval_precision_5 = round((precision_total_hits / total_chunks_inspected) * 100, 1)

    # 2. Resume Extraction Evaluation
    print("\n--- 2. RESUME SKILL EXTRACTION EVALUATION (Ground Truth F1) ---")
    from backend.ai.agents.resume_agent import _heuristic_resume_fallback
    tp_total, fp_total, fn_total = 0, 0, 0

    for i, res_item in enumerate(RESUME_BENCHMARK, 1):
        text = res_item["text"]
        gt_set = set(res_item["ground_truth"])

        parsed_data = _heuristic_resume_fallback(text)
        extracted = set(parsed_data.skills)

        tp = len(extracted.intersection(gt_set))
        fp = len(extracted - gt_set)
        fn = len(gt_set - extracted)

        tp_total += tp
        fp_total += fp
        fn_total += fn

        print(f"Resume {i}: Extracted {len(extracted)} skills | TP={tp}, FP={fp}, FN={fn} | Skills: {sorted(list(extracted))[:5]}...")

    precision = tp_total / (tp_total + fp_total) if (tp_total + fp_total) > 0 else 1.0
    recall = tp_total / (tp_total + fn_total) if (tp_total + fn_total) > 0 else 1.0
    f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    resume_p = round(precision * 100, 1)
    resume_r = round(recall * 100, 1)
    resume_f1 = round(f1_score * 100, 1)

    # 3. Validator Hallucination Rejection Evaluation
    print("\n--- 3. PYTHON VALIDATOR HALLUCINATION REJECTION (5 Cases) ---")
    hallucination_cases = [c for c in VALIDATOR_BENCHMARK if c["expect_rejection"]]
    valid_cases = [c for c in VALIDATOR_BENCHMARK if not c["expect_rejection"]]

    rejected_count = 0
    for case in hallucination_cases:
        val = validate_ai_response(case["text"], ml_context=case["context"], citations=case["citations"])
        is_rejected = not val.passed
        if is_rejected:
            rejected_count += 1
        print(f"Hallucination Test: [{'✓ PASS' if is_rejected else '✗ FAIL'}] '{case['name']}' -> Violations: {val.violations[:1]}")

    validator_rejection_rate = round((rejected_count / len(hallucination_cases)) * 100, 1)

    # Clean executive console report table
    print("\n" + "=" * 80)
    print(f"{'METRIC':<36} | {'SCORE':<10} | {'TARGET':<10} | {'STATUS':<8}")
    print("-" * 80)
    print(f"{'Supervisor Routing Accuracy':<36} | {routing_accuracy:>8}% | {'>= 85%':<10} | {'PASSED' if routing_accuracy >= 85 else 'REVIEW':<8}")
    print(f"{'Hybrid RAG Hit Rate@5':<36} | {retrieval_hit_rate:>8}% | {'>= 80%':<10} | {'PASSED' if retrieval_hit_rate >= 80 else 'REVIEW':<8}")
    print(f"{'Hybrid RAG Precision@5':<36} | {retrieval_precision_5:>8}% | {'>= 35%':<10} | {'PASSED' if retrieval_precision_5 >= 35 else 'REVIEW':<8}")
    print(f"{'Resume Skill Extraction F1':<36} | {resume_f1:>8}% | {'>= 85%':<10} | {'PASSED' if resume_f1 >= 85 else 'REVIEW':<8}")
    print(f"{'Validator Hallucination Rejection':<36} | {validator_rejection_rate:>8}% | {'100%':<10} | {'PASSED' if validator_rejection_rate == 100 else 'FAILED':<8}")
    print("=" * 80)

    report_data = {
        "benchmark_summary": {
            "total_queries": total_queries,
            "routing_accuracy_pct": routing_accuracy,
            "retrieval_hit_rate_at_5_pct": retrieval_hit_rate,
            "retrieval_precision_at_5_pct": retrieval_precision_5,
            "resume_extraction": {
                "precision_pct": resume_p,
                "recall_pct": resume_r,
                "f1_score_pct": resume_f1,
            },
            "validator_rejection_rate_pct": validator_rejection_rate,
        },
        "status": "PASSED" if (routing_accuracy >= 85 and validator_rejection_rate == 100) else "REVIEW",
    }

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)

    print(f"✓ AI Evaluation Report saved to: {REPORT_FILE.resolve()}")
    return report_data


if __name__ == "__main__":
    run_offline_evaluation()
