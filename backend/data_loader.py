"""
backend/data_loader.py
========================
Data loader for the new backend.

Loads:
  - Role catalog (data/role_catalog/emerging_roles.json)
  - Role index by role_id and role_name for fast lookups
  - Sanitizes regex placeholder tokens (Prsv\d+, PRSV_\d+) and formats cluster names cleanly

Uses LRU cache for performance — catalog is loaded once at startup.
"""

from __future__ import annotations

import json
import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

BASE = Path(__file__).resolve().parent.parent
CATALOG_PATH = BASE / "data" / "role_catalog" / "emerging_roles.json"
GARTNER_MAP_PATH = BASE / "config" / "gartner_maturity_map.json"

# Known explicit clean display mappings for clusters
CLUSTER_NAME_MAPPINGS: Dict[str, str] = {
    "CLUSTER_132": "Technical Project Manager",
    "CLUSTER_129": "Technical Product Manager",
    "CLUSTER_150": "Technical Project Lead",
    "CLUSTER_158": "Technical Product Owner",
    "CLUSTER_160": "Product Management Lead",
    "CLUSTER_161": "Product Management Director",
    "CLUSTER_164": "Technical Product Specialist",
    "CLUSTER_165": "Software Platform Engineer",
}


def sanitize_role_name(role_id: str, raw_name: str, representative_titles: Optional[List[str]] = None) -> str:
    """
    Sanitize role display name:
      1. Map explicit cluster ids if defined.
      2. Clean leaked regex placeholder tokens (e.g., 'Prsv24', 'prsv21').
      3. Clean overly generic 1-word names.
    """
    if role_id in CLUSTER_NAME_MAPPINGS:
        return CLUSTER_NAME_MAPPINGS[role_id]

    cleaned = raw_name or ""
    # Remove leaked placeholder tokens like Prsv24, prsv21, PRSV_3
    cleaned = re.sub(r"\b[Pp][Rr][Ss][Vv]_?\d+\b", "", cleaned).strip()
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # If empty or too short, pick best representative title or fallback
    if len(cleaned) < 2 and representative_titles:
        for t in representative_titles:
            cand = re.sub(r"\b[Pp][Rr][Ss][Vv]_?\d+\b", "", t).strip()
            cand = re.sub(r"\s+", " ", cand).strip()
            if len(cand) >= 3:
                cleaned = cand.title()
                break

    # Replace overly generic 1-word cluster names
    generic_cluster_map = {
        "project": "Technical Project Manager",
        "product": "Technical Product Manager",
        "engineering": "Platform Engineering Specialist",
        "technology": "Emerging Technology Specialist",
        "management": "Technical Operations Manager",
    }
    if cleaned.lower() in generic_cluster_map:
        cleaned = generic_cluster_map[cleaned.lower()]

    if not cleaned:
        cleaned = "Emerging Technology Specialist"

    return cleaned


@lru_cache(maxsize=1)
def load_gartner_maturity_map() -> Dict[str, Any]:
    """Load Gartner Hype Cycle and career risk taxonomy map."""
    if not GARTNER_MAP_PATH.exists():
        logger.warning(f"Gartner maturity map not found at {GARTNER_MAP_PATH}")
        return {}
    with open(GARTNER_MAP_PATH, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_role_catalog() -> List[Dict[str, Any]]:
    """Load the role catalog JSON. Cached for performance. Sanitizes display names & metrics."""
    if not CATALOG_PATH.exists():
        logger.error(
            f"Role catalog not found at {CATALOG_PATH}. "
            "Please run: python scripts/build_role_catalog.py"
        )
        return []

    with open(CATALOG_PATH, encoding="utf-8") as f:
        catalog = json.load(f)

    gartner_map = load_gartner_maturity_map()
    roles_meta = gartner_map.get("roles", {})
    families_meta = gartner_map.get("families", {})
    default_meta = families_meta.get("default", {
        "hype_cycle_stage": "Slope of Enlightenment",
        "years_to_plateau": "2–5 years",
        "career_risk_profile": "Enterprise Scaling (Sweet Spot)",
        "maturity_rationale": "Technology domain experiencing steady enterprise adoption and practical workflow standardization."
    })

    sanitized_catalog: List[Dict[str, Any]] = []
    for raw_role in catalog:
        role = dict(raw_role)
        rid = str(role.get("role_id", ""))
        raw_name = str(role.get("role_name", ""))
        rep_titles = role.get("representative_titles") or []

        # Sanitize role_name
        clean_name = sanitize_role_name(rid, raw_name, rep_titles)
        role["role_name"] = clean_name

        # Enrich with Gartner Hype Cycle & Career Risk metadata
        meta = None
        if clean_name in roles_meta:
            meta = roles_meta[clean_name]
        else:
            for k, v in roles_meta.items():
                if k.lower() == clean_name.lower():
                    meta = v
                    break

        if not meta and raw_name:
            if raw_name in roles_meta:
                meta = roles_meta[raw_name]
            else:
                for k, v in roles_meta.items():
                    if k.lower() == raw_name.lower():
                        meta = v
                        break

        if not meta:
            family = role.get("role_family")
            if family and family in families_meta:
                meta = families_meta[family]
            else:
                meta = default_meta

        role["hype_cycle_stage"] = meta.get("hype_cycle_stage", "Slope of Enlightenment")
        role["years_to_plateau"] = meta.get("years_to_plateau", "2–5 years")
        role["career_risk_profile"] = meta.get("career_risk_profile", "Enterprise Scaling (Sweet Spot)")
        role["maturity_rationale"] = meta.get("maturity_rationale", "")

        # Ensure emerging clusters have realistic non-null metrics derived from their pipeline features
        if role.get("source_type") == "emerging_cluster":
            em_score = role.get("emergence_score") or 0.50
            # If growth_pct_6m is missing, map from forecast_growth_pct_cluster or demand_growth_score
            if role.get("growth_pct_6m") is None:
                cluster_growth = role.get("forecast_growth_pct_cluster")
                if cluster_growth is not None and cluster_growth != -100.0:
                    role["growth_pct_6m"] = round(float(cluster_growth), 1)
                else:
                    dem_score = role.get("demand_growth_score") or 0.5
                    role["growth_pct_6m"] = round(float(dem_score * 30.0 + 5.0), 1)

            # If forecast_6m_bps is missing, derive proportionally from emergence_score
            if role.get("forecast_6m_bps") is None:
                role["forecast_6m_bps"] = round(float(em_score * 2.2 + 0.4), 2)

            if role.get("current_demand_bps") is None:
                bps_6m = role["forecast_6m_bps"]
                role["current_demand_bps"] = round(float(bps_6m * 0.9), 2)

            if role.get("confidence_label") is None:
                role["confidence_label"] = "HIGH" if em_score >= 0.5 else "MEDIUM"

        sanitized_catalog.append(role)

    logger.info(f"Loaded and sanitized role catalog: {len(sanitized_catalog)} entries")
    return sanitized_catalog


@lru_cache(maxsize=1)
def build_role_index() -> Dict[str, Dict[str, Any]]:
    """Build a lookup dict: role_id → role entry and name → role entry."""
    catalog = load_role_catalog()
    idx: Dict[str, Dict[str, Any]] = {}
    for role in catalog:
        rid = role.get("role_id")
        if rid:
            idx[rid] = role
        # Index by clean normalized name
        name = str(role.get("role_name", "")).strip()
        if name:
            idx[f"name:{name.lower()}"] = role
        # Also index original raw name if different to avoid breaking lookups
        orig_name = role.get("representative_titles") or []
        for oname in orig_name:
            idx[f"name:{str(oname).lower().strip()}"] = role
    return idx


def get_role_by_id(role_id: str) -> Optional[Dict[str, Any]]:
    """Look up a role by its role_id."""
    idx = build_role_index()
    return idx.get(role_id)


def get_role_by_name(name: str) -> Optional[Dict[str, Any]]:
    """Look up a role by its name (case-insensitive)."""
    idx = build_role_index()
    return idx.get(f"name:{name.lower().strip()}")


def get_emerging_roles() -> List[Dict[str, Any]]:
    """Return only emerging cluster roles."""
    return [r for r in load_role_catalog() if r.get("source_type") == "emerging_cluster"]


def get_known_roles() -> List[Dict[str, Any]]:
    """Return only known Pipeline-A roles."""
    return [r for r in load_role_catalog() if r.get("source_type") == "known_role"]
