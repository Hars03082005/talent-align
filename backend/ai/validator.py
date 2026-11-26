"""
backend/ai/validator.py
=======================
Deterministic Python Validator to enforce zero-hallucination guardrails.
Verifies:
  1. Mentioned forecasts (bps / %) and match scores match actual ml_context.
  2. Mentioned IT roles exist in the 60-role catalog.
  3. Responses cite verified ML tools or catalog sources.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from backend.data_loader import build_role_index, load_role_catalog

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    passed: bool
    violations: List[str] = field(default_factory=list)
    verified_numbers: List[float] = field(default_factory=list)
    flagged_numbers: List[float] = field(default_factory=list)
    flagged_roles: List[str] = field(default_factory=list)


def _get_known_role_names() -> Set[str]:
    """Retrieve normalized set of all 60 role names from catalog."""
    catalog = load_role_catalog()
    names = set()
    for r in catalog:
        name = str(r.get("role_name", "")).strip().lower()
        if name:
            names.add(name)
            # Add common variations
            names.add(name.replace("/", " "))
            names.add(name.replace("-", " "))
    return names


def _extract_numbers_from_context(ml_context: Dict[str, Any]) -> List[float]:
    """Recursively collect all numerical ground truth metrics from ml_context."""
    numbers: List[float] = []

    def _walk(item: Any):
        if isinstance(item, (int, float)):
            # Ignore boolean (which is subclass of int) and zero
            if not isinstance(item, bool):
                numbers.append(round(float(item), 2))
        elif isinstance(item, dict):
            for v in item.values():
                _walk(v)
        elif isinstance(item, list):
            for v in item:
                _walk(v)

    _walk(ml_context)
    return numbers


def _extract_metric_numbers_from_text(text: str) -> List[float]:
    """Extract percentages and basis points stated in the text (e.g., 28.5%, -4.2%, 180 bps)."""
    found: List[float] = []

    # Match percentages: e.g. 85%, 28.5%, -12%
    pct_matches = re.findall(r"([+-]?\d+(?:\.\d+)?)\s*%", text)
    for m in pct_matches:
        try:
            found.append(round(float(m), 2))
        except ValueError:
            pass

    # Match basis points: e.g. 180 bps, +45.2 bps
    bps_matches = re.findall(r"([+-]?\d+(?:\.\d+)?)\s*bps\b", text, re.IGNORECASE)
    for m in bps_matches:
        try:
            found.append(round(float(m), 2))
        except ValueError:
            pass

    return found


def validate_ai_response(
    text: str,
    ml_context: Optional[Dict[str, Any]] = None,
    citations: Optional[List[str]] = None,
    tolerance: float = 1.0,
) -> ValidationResult:
    """
    Validate that:
      1. Every cited metric (% or bps) exists in ml_context within numerical tolerance.
      2. No non-catalog role names are fabricated.
      3. Citations or sources are referenced.
    """
    violations: List[str] = []
    flagged_numbers: List[float] = []
    verified_numbers: List[float] = []
    flagged_roles: List[str] = []

    context_dict = ml_context or {}
    ground_truth_numbers = _extract_numbers_from_context(context_dict)

    # 1. Number Verification (% and bps)
    extracted_nums = _extract_metric_numbers_from_text(text)
    for num in extracted_nums:
        # Check if number matches any ground truth within tolerance
        matched = any(abs(num - gt) <= tolerance for gt in ground_truth_numbers)
        if matched:
            verified_numbers.append(num)
        else:
            # Check if it might be an integer rounding of a float
            alt_matched = any(abs(round(num) - round(gt)) <= 1.0 for gt in ground_truth_numbers)
            if alt_matched:
                verified_numbers.append(num)
            else:
                flagged_numbers.append(num)
                violations.append(
                    f"Hallucinated or ungrounded metric detected: {num} (not found in ML context)."
                )

    # 2. Role Name Verification
    known_roles = _get_known_role_names()
    context_roles: Set[str] = set()
    for key in ["job_titles", "allowed_roles", "role_name", "roles"]:
        val = context_dict.get(key)
        if isinstance(val, list):
            for v in val:
                context_roles.add(str(v).strip().lower())
        elif isinstance(val, str):
            context_roles.add(val.strip().lower())

    role_pattern = re.findall(
        r"\b([A-Z][a-zA-Z0-9\+\#\.\/]+(?:\s+[A-Z][a-zA-Z0-9\+\#\.\/]+)*\s+(?:Engineer|Architect|Specialist|Developer|Administrator|Lead|Scientist|Wizard|Ninja|Guru|Consultant|Manager))\b",
        text,
    )
    for candidate in role_pattern:
        cand_clean = candidate.strip().lower().replace("/", " ").replace("-", " ")
        # Check if candidate or substring matches any known role or contextual job title
        is_known = (
            any(cand_clean in k or k in cand_clean for k in known_roles)
            or any(cand_clean in cr or cr in cand_clean for cr in context_roles)
        )
        if not is_known:
            flagged_roles.append(candidate)
            violations.append(
                f"Unknown or hallucinated role name detected: '{candidate}' (not in 60-role catalog)."
            )

    # 3. Citation Check
    has_bracket_citation = bool(re.search(r"\[(Role Catalog|ML Tool|SHAP|Roadmap|Source)[^\]]*\]", text, re.IGNORECASE))
    has_explicit_citations = bool(citations and len(citations) > 0)
    if not has_bracket_citation and not has_explicit_citations:
        violations.append("Response lacks mandatory provenance citations (e.g., [Role Catalog: <role_id>]).")

    passed = len(violations) == 0
    return ValidationResult(
        passed=passed,
        violations=violations,
        verified_numbers=verified_numbers,
        flagged_numbers=flagged_numbers,
        flagged_roles=flagged_roles,
    )
