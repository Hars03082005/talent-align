"""
tests/test_jobs.py
===================
Tests for Daily Job Intelligence:
  1. SHA-256 deduplication
  2. Deterministic match scoring
  3. GET /jobs/search
  4. POST /jobs/save
  5. POST /jobs/refresh
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.jobs.collector import generate_content_hash, CURATED_SEED_JOBS
from backend.jobs.matcher import compute_job_match

client = TestClient(app)


def test_sha256_content_hash_deduplication():
    """Verify identical title, company, and location generate identical SHA-256 hash."""
    hash1 = generate_content_hash("Google", "Site Reliability Engineer", "Bengaluru")
    hash2 = generate_content_hash("google ", "Site Reliability Engineer  ", " Bengaluru")
    assert hash1 == hash2
    assert len(hash1) == 64

    diff_hash = generate_content_hash("Google", "DevOps Engineer", "Bengaluru")
    assert hash1 != diff_hash


def test_deterministic_job_matcher():
    """Verify pure Python deterministic scoring formula."""
    candidate = {
        "declared_skills": ["Python", "PyTorch", "Large Language Model", "Docker"],
        "target_roles": ["Generative AI Engineer"],
        "experience_level": "Mid Level",
        "work_mode_preference": "remote",
    }
    job = {
        "title": "Generative AI Engineer",
        "required_skills": ["Python", "PyTorch", "Large Language Model", "Docker"],
        "preferred_skills": ["LangChain"],
        "experience_level": "Mid Level",
        "work_mode": "Remote",
    }
    res = compute_job_match(candidate, job)
    assert res["match_score"] >= 85.0
    assert "Python" in res["matched_skills"]
    assert len(res["missing_skills"]) == 0
    assert "required_skills" in res["breakdown"]


def test_jobs_search_endpoint():
    """Verify GET /jobs/search returns active listings and expected schema."""
    resp = client.get("/jobs/search?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "jobs" in data
    assert len(data["jobs"]) > 0

    first_job = data["jobs"][0]
    assert "title" in first_job
    assert "company" in first_job
    assert "match_score" in first_job
    assert "matching_skills" in first_job
    assert "missing_skills" in first_job


def test_jobs_save_and_retrieve_saved():
    """Verify POST /jobs/save tracks status and GET /jobs/saved/{user_id} retrieves it."""
    # Ensure test user exists in database
    user_payload = {
        "name": "Job Tracker Candidate",
        "email": "tracker@example.com",
    }
    user_resp = client.post("/users", json=user_payload)
    assert user_resp.status_code == 201
    test_user_id = user_resp.json()["id"]

    # Fetch a valid job id first
    search_resp = client.get("/jobs/search?limit=1")
    assert search_resp.status_code == 200
    jobs = search_resp.json()["jobs"]
    assert len(jobs) > 0
    target_job_id = jobs[0]["id"]

    save_payload = {
        "user_id": test_user_id,
        "job_id": target_job_id,
        "status": "applied",
    }
    save_resp = client.post("/jobs/save", json=save_payload)
    assert save_resp.status_code == 200
    assert save_resp.json()["status"] == "success"

    # Retrieve tracked jobs
    get_resp = client.get(f"/jobs/saved/{test_user_id}")
    assert get_resp.status_code == 200
    saved_list = get_resp.json()
    assert len(saved_list) >= 1
    assert any(j["id"] == target_job_id and j.get("application_status") == "applied" for j in saved_list)


def test_jobs_refresh_endpoint():
    """Verify POST /jobs/refresh executes collection without errors."""
    resp = client.post("/jobs/refresh")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "summary" in data
    assert data["summary"]["jobs_fetched"] > 0
