"""
tests/test_saas_features.py
===========================
Automated test suite verifying the production SaaS Job Intelligence capabilities:
  - Real job listing ingestion, search, and filtering
  - Transparent candidate compatibility scoring
  - Candidate profile updates and skill management
  - Bookmarked / Saved jobs lifecycle
  - Market skill gap analysis
  - Evidence-based Career Action Plan generation and milestone tracking
  - Grounded RAG AI Career Assistant
  - Macro market overview statistics
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_db, init_db, get_session
from backend.db_models import User, JobListing

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()


def test_market_overview_endpoint():
    """Verify macro market intelligence statistics endpoint."""
    response = client.get("/market/overview")
    assert response.status_code == 200
    data = response.json()
    assert "total_active_listings" in data
    assert data["total_active_listings"] > 0
    assert "top_demand_skills" in data
    assert len(data["top_demand_skills"]) > 0
    assert "work_mode_distribution" in data
    assert "salary_insights" in data


def test_job_search_and_filter_endpoints():
    """Verify job search, remote filtering, and pagination."""
    # 1. Base list
    resp = client.get("/jobs?page=1&page_size=10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] > 0
    assert len(data["jobs"]) <= 10
    first_job = data["jobs"][0]
    assert "id" in first_job
    assert "title" in first_job
    assert "application_url" in first_job

    # 2. Filter by search query
    resp_search = client.get("/jobs?query=Engineer&page_size=5")
    assert resp_search.status_code == 200
    search_data = resp_search.json()
    assert search_data["total"] > 0

    # 3. Filter by work mode
    resp_remote = client.get("/jobs?location_type=remote&page_size=5")
    assert resp_remote.status_code == 200

    # 4. Job detail
    job_id = first_job["id"]
    resp_detail = client.get(f"/jobs/{job_id}")
    assert resp_detail.status_code == 200
    detail = resp_detail.json()
    assert detail["id"] == job_id
    assert "description" in detail


def test_candidate_profile_and_matching():
    """Verify candidate profile persistence, compatibility score calculation, and bookmarking."""
    user_id = "test-saas-user-999"

    # 1. Update Profile
    profile_payload = {
        "name": "Jane Developer",
        "email": "jane.dev@example.com",
        "education": "Master of Science",
        "degree_stream": "Computer Science",
        "experience_level": "Mid Level",
        "experience_years": 3.0,
        "work_mode_preference": "remote",
        "declared_skills": ["Python", "Docker", "SQL", "AWS", "FastAPI"],
        "target_roles": ["Software Engineer", "Backend Developer"],
    }
    resp_put = client.put(f"/profile/{user_id}", json=profile_payload)
    assert resp_put.status_code == 200
    prof = resp_put.json()
    assert prof["name"] == "Jane Developer"
    assert "Python" in prof["declared_skills"]

    # 2. Get Profile
    resp_get = client.get(f"/profile/{user_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["email"] == "jane.dev@example.com"

    # 3. Personalized Job Matches
    resp_matches = client.get(f"/jobs/matches/{user_id}?limit=10")
    assert resp_matches.status_code == 200
    matches = resp_matches.json()
    assert len(matches) > 0
    top_match = matches[0]
    assert "compatibility_score" in top_match
    assert top_match["compatibility_score"] is not None
    assert top_match["compatibility_score"] >= 0.0

    # 4. Save Job
    target_job_id = top_match["id"]
    resp_save = client.post(f"/jobs/{target_job_id}/save?user_id={user_id}&notes=Top+choice")
    assert resp_save.status_code == 200

    # 5. Retrieve Saved Jobs
    resp_saved_list = client.get(f"/users/{user_id}/saved-jobs")
    assert resp_saved_list.status_code == 200
    saved_jobs = resp_saved_list.json()
    assert any(j["id"] == target_job_id for j in saved_jobs)

    # 6. Unsave Job
    resp_unsave = client.delete(f"/jobs/{target_job_id}/save?user_id={user_id}")
    assert resp_unsave.status_code == 200


def test_skill_gap_and_action_plan_flow():
    """Verify market skill gap computation and personalized 4-stage action plan generation."""
    user_id = "test-saas-user-999"

    # 1. Market Skill Gap
    resp_gap = client.post(f"/skill-gap/market?user_id={user_id}&target_role=Software+Engineer")
    assert resp_gap.status_code == 200
    gap = resp_gap.json()
    assert "possessed_skills" in gap
    assert "missing_skills" in gap
    assert gap["total_target_jobs_analyzed"] > 0

    # 2. Generate Action Plan
    plan_payload = {
        "user_id": user_id,
        "target_role": "Software Engineer",
    }
    resp_plan = client.post("/action-plan/generate", json=plan_payload)
    assert resp_plan.status_code == 200
    plan = resp_plan.json()
    assert "id" in plan
    assert plan["target_role"] == "Software Engineer"
    assert len(plan["items"]) == 4  # Foundation, Core, Applied, Capstone

    first_item = plan["items"][0]
    assert "stage" in first_item
    assert "resources" in first_item

    # 3. Update Action Item Status
    item_id = first_item["id"]
    resp_status = client.patch(f"/action-plan/item/{item_id}", json={"status": "in_progress"})
    assert resp_status.status_code == 200
    assert resp_status.json()["new_status"] == "in_progress"

    # 4. Fetch User Plans
    resp_user_plans = client.get(f"/action-plan/{user_id}")
    assert resp_user_plans.status_code == 200
    assert len(resp_user_plans.json()) >= 1


def test_ai_career_assistant_endpoint():
    """Verify Grounded AI Assistant RAG chat endpoint."""
    user_id = "test-saas-user-999"

    chat_payload = {
        "message": "Why do I match with software engineering roles, and what should I learn next?",
        "user_id": user_id,
    }
    resp = client.post("/ai/chat", json=chat_payload)
    assert resp.status_code == 200
    chat_resp = resp.json()
    assert "reply" in chat_resp
    assert len(chat_resp["reply"]) > 20
    assert "grounded_facts" in chat_resp
    assert "suggested_followups" in chat_resp
