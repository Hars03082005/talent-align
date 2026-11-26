"""
tests/test_role_catalog.py
===========================
Tests for the generated canonical role catalog.
"""

from __future__ import annotations

import json
from pathlib import Path
import pytest
from backend.data_loader import load_role_catalog, get_role_by_name, get_emerging_roles, get_known_roles

CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "role_catalog" / "emerging_roles.json"


def test_catalog_file_exists():
    assert CATALOG_PATH.exists(), f"Catalog file not found at {CATALOG_PATH}"


def test_catalog_loads_and_non_empty():
    catalog = load_role_catalog()
    assert isinstance(catalog, list)
    assert len(catalog) >= 50, f"Expected at least 50 roles, got {len(catalog)}"


def test_catalog_contains_both_types():
    known = get_known_roles()
    emerging = get_emerging_roles()
    assert len(known) >= 30, f"Expected >= 30 known roles, got {len(known)}"
    assert len(emerging) >= 15, f"Expected >= 15 emerging cluster roles, got {len(emerging)}"


def test_catalog_schema_fields():
    catalog = load_role_catalog()
    required_keys = [
        "role_name",
        "source_type",
        "required_skills",
        "frontier_skills",
    ]
    for role in catalog:
        for k in required_keys:
            assert k in role, f"Missing key '{k}' in role '{role.get('role_name')}'"


def test_no_empty_role_names():
    catalog = load_role_catalog()
    for role in catalog:
        assert role["role_name"] and len(role["role_name"].strip()) > 0


def test_gartner_maturity_metadata_in_catalog():
    """Verify that 100% of all catalog roles contain valid Gartner maturity and career risk metadata."""
    catalog = load_role_catalog()
    assert len(catalog) == 60, f"Expected 60 roles, got {len(catalog)}"

    valid_stages = {
        "Innovation Trigger",
        "Peak of Inflated Expectations",
        "Trough of Disillusionment",
        "Slope of Enlightenment",
        "Plateau of Productivity",
    }
    valid_risk_profiles = {
        "Early Frontier",
        "High Hype / Volatile",
        "Enterprise Scaling (Sweet Spot)",
        "Mature / Stable",
    }

    for role in catalog:
        rname = role.get("role_name")
        stage = role.get("hype_cycle_stage")
        years = role.get("years_to_plateau")
        risk = role.get("career_risk_profile")
        rationale = role.get("maturity_rationale")

        assert stage in valid_stages, f"Invalid or missing hype_cycle_stage '{stage}' for role '{rname}'"
        assert years and isinstance(years, str), f"Missing years_to_plateau for role '{rname}'"
        assert risk in valid_risk_profiles, f"Invalid or missing career_risk_profile '{risk}' for role '{rname}'"
        assert rationale and len(rationale.strip()) > 10, f"Missing or brief maturity_rationale for role '{rname}'"



def test_api_roles_catalog_and_detail_gartner_fields():
    """Verify that GET /roles/catalog and GET /roles/{role_id} expose Gartner metadata."""
    from fastapi.testclient import TestClient
    from backend.main import app

    client = TestClient(app)

    # 1. GET /roles/catalog
    res = client.get("/roles/catalog")
    assert res.status_code == 200
    catalog = res.json()
    assert len(catalog) == 60
    first = catalog[0]
    assert "hype_cycle_stage" in first and first["hype_cycle_stage"] is not None
    assert "career_risk_profile" in first and first["career_risk_profile"] is not None
    assert "years_to_plateau" in first and first["years_to_plateau"] is not None
    assert "maturity_rationale" in first and first["maturity_rationale"] is not None

    # 2. GET /roles/ROLE_1001 (Generative AI Engineer)
    res_detail = client.get("/roles/ROLE_1001")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["role_name"] == "Generative AI Engineer"
    assert detail["hype_cycle_stage"] == "Peak of Inflated Expectations"
    assert detail["career_risk_profile"] == "High Hype / Volatile"
    assert detail["years_to_plateau"] == "2–5 years"
