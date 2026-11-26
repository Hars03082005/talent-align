"""
backend/services/action_plan_service.py
=======================================
Generates evidence-based, milestone-oriented Career Action Plans
grounded directly in target job market missing skills.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.db_models import ActionPlanItem, CareerActionPlan, JobListing, User, utc_now
from backend.models import CareerActionPlanResponse
from backend.services.skill_gap_service import compute_market_skill_gap

logger = logging.getLogger(__name__)


VERIFIED_SKILL_RESOURCES = {
    "python": [
        {"name": "Python Official Documentation & Tutorial", "url": "https://docs.python.org/3/tutorial/"},
        {"name": "Real Python Tutorials", "url": "https://realpython.com/"},
    ],
    "react": [
        {"name": "React Official Documentation", "url": "https://react.dev/"},
        {"name": "Full Stack Open (University of Helsinki)", "url": "https://fullstackopen.com/en/"},
    ],
    "docker": [
        {"name": "Docker Official Getting Started Guide", "url": "https://docs.docker.com/get-started/"},
        {"name": "Docker for Developers (FreeCodeCamp)", "url": "https://www.freecodecamp.org/news/docker-for-developers/"},
    ],
    "kubernetes": [
        {"name": "Kubernetes Official Tutorials", "url": "https://kubernetes.io/docs/tutorials/"},
    ],
    "aws": [
        {"name": "AWS Cloud Practitioner Essentials", "url": "https://aws.amazon.com/training/digital/aws-cloud-practitioner-essentials/"},
    ],
    "sql": [
        {"name": "PostgreSQL Tutorial", "url": "https://www.postgresqltutorial.com/"},
        {"name": "Mode Analytics SQL Tutorial", "url": "https://mode.com/sql-tutorial/"},
    ],
    "machine learning": [
        {"name": "Fast.ai Practical Deep Learning for Coders", "url": "https://course.fast.ai/"},
        {"name": "Scikit-Learn User Guide", "url": "https://scikit-learn.org/stable/user_guide.html"},
    ],
}


def get_resources_for_skill(skill: str) -> List[Dict[str, str]]:
    """Retrieve verified resources for a skill, falling back to clean authoritative sources."""
    s_clean = skill.lower().strip()
    for k, v in VERIFIED_SKILL_RESOURCES.items():
        if k in s_clean or s_clean in k:
            return v
    return [
        {"name": f"{skill} Official Documentation & Guides", "url": f"https://developer.mozilla.org/en-US/search?q={skill}"},
        {"name": f"Learn {skill} on FreeCodeCamp", "url": f"https://www.freecodecamp.org/news/search/?query={skill}"},
    ]


def generate_action_plan(
    db: Session,
    user: User,
    target_role: str,
    target_job_id: Optional[str] = None,
) -> CareerActionPlan:
    """
    Generate and persist a structured, personalized 4-stage action plan for a candidate.
    """
    # 1. Analyze skill gaps for the target role
    gap_data = compute_market_skill_gap(db, user, target_role=target_role)
    missing = [m.skill for m in gap_data.missing_skills]
    if not missing:
        missing = ["System Design", "Cloud Infrastructure (AWS/GCP)", "CI/CD Automation", "Test-Driven Development"]

    # 2. Structure stages
    plan_title = f"{target_role} Acceleration Plan"
    plan_summary = (
        f"Customized learning roadmap targeting active employer requirements for {target_role}. "
        f"Prioritizes top missing capabilities ({', '.join(missing[:3])}) to maximize job match score."
    )

    plan = CareerActionPlan(
        user_id=user.id,
        target_role=target_role,
        title=plan_title,
        summary=plan_summary,
        total_estimated_hours=60,
    )
    db.add(plan)
    db.flush()  # get plan.id

    items = []
    priority = 1

    # Stage 1: Foundation (Missing core language/tool)
    foundation_skill = missing[0] if len(missing) > 0 else "Core Fundamentals"
    items.append(
        ActionPlanItem(
            plan_id=plan.id,
            stage="Foundation",
            priority=priority,
            title=f"Master {foundation_skill} Core Mechanics",
            description=f"Establish rigorous foundational fluency in {foundation_skill} as required by majority of openings.",
            target_skill=foundation_skill,
            why_needed=f"Appears as a mandatory requirement across target job postings.",
            learning_objectives=json.dumps([
                f"Understand core syntax, runtime patterns, and standard libraries of {foundation_skill}",
                "Implement 3 algorithmic exercises focusing on clean, idiomatic code",
                "Write unit tests verifying edge cases and error handling",
            ]),
            practice_project=f"Build a command-line tool using {foundation_skill} with comprehensive error handling and unit tests.",
            estimated_hours=12,
            status="not_started",
            resources=json.dumps(get_resources_for_skill(foundation_skill)),
        )
    )
    priority += 1

    # Stage 2: Core (Framework / API / Data Layer)
    core_skill = missing[1] if len(missing) > 1 else "Modern API & Framework Patterns"
    items.append(
        ActionPlanItem(
            plan_id=plan.id,
            stage="Core",
            priority=priority,
            title=f"Build Production APIs & Services with {core_skill}",
            description=f"Deepen proficiency in {core_skill} through architectural patterns, state management, and API design.",
            target_skill=core_skill,
            why_needed=f"Key technical differentiator that elevates candidate compatibility from entry to competitive.",
            learning_objectives=json.dumps([
                f"Design RESTful / GraphQL endpoints following OpenAPI specifications",
                f"Integrate persistent storage and caching layers with {core_skill}",
                "Configure authentication and structured logging",
            ]),
            practice_project=f"Develop a complete CRUD service with {core_skill} connected to a database with automated validation.",
            estimated_hours=18,
            status="not_started",
            resources=json.dumps(get_resources_for_skill(core_skill)),
        )
    )
    priority += 1

    # Stage 3: Applied (DevOps / Containerization / Cloud)
    applied_skill = missing[2] if len(missing) > 2 else "Containerization & Cloud Infrastructure"
    items.append(
        ActionPlanItem(
            plan_id=plan.id,
            stage="Applied",
            priority=priority,
            title=f"Containerization and Deployment using {applied_skill}",
            description=f"Demonstrate applied engineering capability by packaging services with {applied_skill} and configuring deployment.",
            target_skill=applied_skill,
            why_needed=f"Companies value candidates who can deploy and monitor their own services independently.",
            learning_objectives=json.dumps([
                "Write optimized multi-stage Dockerfiles and container configurations",
                "Automate test execution and linting via GitHub Actions CI pipeline",
                "Deploy service to a cloud provider with environment secrets management",
            ]),
            practice_project=f"Containerize previous projects with {applied_skill} and set up automated CI/CD pipeline on GitHub.",
            estimated_hours=15,
            status="not_started",
            resources=json.dumps(get_resources_for_skill(applied_skill)),
        )
    )
    priority += 1

    # Stage 4: Capstone Portfolio Project
    capstone_skill = missing[3] if len(missing) > 3 else "End-to-End System Integration"
    items.append(
        ActionPlanItem(
            plan_id=plan.id,
            stage="Capstone",
            priority=priority,
            title=f"End-to-End {target_role} Portfolio Capstone",
            description=f"Create a standout GitHub portfolio project demonstrating all target skills ({', '.join(missing[:3])}) to present to recruiters.",
            target_skill=capstone_skill,
            why_needed=f"Directly addresses hiring managers' need for verified, demonstrable practical proof of capability.",
            learning_objectives=json.dumps([
                f"Architect and build an end-to-end full-stack or ML system solving a real-world problem",
                "Author professional documentation, architecture diagrams, and a live working demo",
                "Record a 2-minute walkthrough video highlighting technical decisions and trade-offs",
            ]),
            practice_project=f"A complete production-ready application tailored to {target_role} featuring interactive UI, robust backend, and live deployment.",
            estimated_hours=15,
            status="not_started",
            resources=json.dumps([
                {"name": "GitHub Portfolio Project Best Practices", "url": "https://docs.github.com/en/get-started"},
                {"name": "System Design Primer", "url": "https://github.com/donnemartin/system-design-primer"},
            ]),
        )
    )

    for item in items:
        db.add(item)

    db.commit()
    db.refresh(plan)
    return plan


def get_user_action_plans(db: Session, user_id: str) -> List[CareerActionPlan]:
    """Retrieve all action plans generated for a user."""
    return (
        db.query(CareerActionPlan)
        .filter(CareerActionPlan.user_id == user_id)
        .order_by(CareerActionPlan.created_at.desc())
        .all()
    )


def update_action_item_status(db: Session, item_id: int, new_status: str) -> Optional[ActionPlanItem]:
    """Update progress status of an action plan item."""
    item = db.query(ActionPlanItem).filter(ActionPlanItem.id == item_id).first()
    if item:
        item.status = new_status
        db.commit()
        db.refresh(item)
    return item
