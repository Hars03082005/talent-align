"""
src/analytics/ai_stress_tester.py
===================================
AI Disruption Shockwave & Skill Half-Life Stress Testing Engine.

Provides empirical stress-testing for career paths and candidate skillsets
under generative AI and autonomous agent market shocks.

Features:
  1. Skill Exposure & Automation Taxonomy (Task displacement vs augmentation vs frontier)
  2. Multi-Tier Shock Scenarios (Baseline, Agentic SWE Breakout, Autonomous Enterprise Saturation)
  3. Career Antifragility Score (0-100) & Skill Half-Life Projection (in months)
  4. Dynamic Role Stress-Testing & Shocked Re-ranking (Shift in priority under AI shocks)
  5. Antifragile Vaccine Prescription (Optimal skills to minimize displacement risk)
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple


# ─── 1. Skill Automation Exposure Taxonomy ─────────────────────────────────────
# Exposure categories:
#   "high_vulnerability": Routine boilerplate, syntax translation, manual script authoring.
#   "augmented": AI acts as co-pilot; productivity multiplies, but architecture/judgment required.
#   "antifragile": Value surges WITH AI expansion (AI creates more demand / cannot automate).

SKILL_TAXONOMY: Dict[str, Dict[str, Any]] = {
    # High Vulnerability / High Automation
    "html/css": {"category": "high_vulnerability", "base_risk": 0.85, "decay_rate": 0.058, "moat": "Low", "description": "High automated code generation by LLMs & visual agents"},
    "javascript": {"category": "augmented", "base_risk": 0.52, "decay_rate": 0.035, "moat": "Medium", "description": "Boilerplate automatable; complex reactive state remains valuable"},
    "sql": {"category": "augmented", "base_risk": 0.48, "decay_rate": 0.032, "moat": "Medium", "description": "Text-to-SQL commoditizes simple queries; complex schema design resilient"},
    "git": {"category": "high_vulnerability", "base_risk": 0.70, "decay_rate": 0.048, "moat": "Low", "description": "Routine branch, merge & commit workflows increasingly automated by agents"},
    "linux": {"category": "augmented", "base_risk": 0.42, "decay_rate": 0.028, "moat": "Medium-High", "description": "Command execution automatable; system troubleshooting & permissions resilient"},
    "bash": {"category": "high_vulnerability", "base_risk": 0.78, "decay_rate": 0.052, "moat": "Low", "description": "Direct shell scripting heavily handled by generative models"},

    # Core Engineering (Augmented)
    "python": {"category": "augmented", "base_risk": 0.38, "decay_rate": 0.024, "moat": "Medium-High", "description": "Primary lingua franca for AI pipelines and data orchestration"},
    "java": {"category": "augmented", "base_risk": 0.55, "decay_rate": 0.038, "moat": "Medium", "description": "Enterprise legacy maintenance; boilerplate assisted by LLMs"},
    "c++": {"category": "antifragile", "base_risk": 0.22, "decay_rate": 0.015, "moat": "High", "description": "High performance computing, memory management, kernel optimization"},
    "typescript": {"category": "augmented", "base_risk": 0.44, "decay_rate": 0.030, "moat": "Medium", "description": "Strong typing helps LLM code reliability, but syntax is commoditizable"},
    "react": {"category": "augmented", "base_risk": 0.54, "decay_rate": 0.036, "moat": "Medium", "description": "UI component generation high; full state architecture remains human-led"},
    "node.js": {"category": "augmented", "base_risk": 0.48, "decay_rate": 0.032, "moat": "Medium", "description": "Backend API scaffolding automated; system throughput & reliability human-driven"},
    "pandas": {"category": "augmented", "base_risk": 0.58, "decay_rate": 0.040, "moat": "Low-Medium", "description": "Routine data cleaning heavily handled by data-analyst agents"},
    "data analysis": {"category": "augmented", "base_risk": 0.52, "decay_rate": 0.036, "moat": "Medium", "description": "Chart generation automated; strategic insight interpretation required"},
    "etl": {"category": "augmented", "base_risk": 0.45, "decay_rate": 0.030, "moat": "Medium", "description": "Modern ETL shifting to automated streaming; data lineage oversight needed"},
    "tableau": {"category": "high_vulnerability", "base_risk": 0.72, "decay_rate": 0.048, "moat": "Low", "description": "Natural language to visual dashboard interfaces reducing manual dashboarding"},
    "power bi": {"category": "high_vulnerability", "base_risk": 0.70, "decay_rate": 0.046, "moat": "Low", "description": "Co-pilot integration commoditizes DAX & report building"},
    "agile / scrum": {"category": "augmented", "base_risk": 0.45, "decay_rate": 0.030, "moat": "Medium", "description": "Sprint tracking automated; human negotiation & team velocity remains key"},

    # Infrastructure & Systems (Resilient / Antifragile)
    "aws": {"category": "augmented", "base_risk": 0.35, "decay_rate": 0.022, "moat": "High", "description": "Cloud infra setup aided by AI; cloud architecture governance critical"},
    "microsoft azure": {"category": "augmented", "base_risk": 0.36, "decay_rate": 0.023, "moat": "High", "description": "Enterprise cloud backbone; deep integration with OpenAI/Copilot stack"},
    "google cloud": {"category": "augmented", "base_risk": 0.35, "decay_rate": 0.022, "moat": "High", "description": "GCP infrastructure & Vertex AI orchestration"},
    "docker": {"category": "augmented", "base_risk": 0.38, "decay_rate": 0.025, "moat": "Medium-High", "description": "Containerization configs automatable; deployment boundary design resilient"},
    "kubernetes": {"category": "antifragile", "base_risk": 0.18, "decay_rate": 0.012, "moat": "Very High", "description": "Complex cluster orchestration, multi-tenant scheduling, high reliability"},
    "terraform": {"category": "augmented", "base_risk": 0.32, "decay_rate": 0.020, "moat": "High", "description": "IaC generation fast with AI; multi-region state management human-led"},
    "devops": {"category": "antifragile", "base_risk": 0.24, "decay_rate": 0.016, "moat": "High", "description": "System reliability engineering and continuous integration oversight"},
    "ci/cd": {"category": "augmented", "base_risk": 0.38, "decay_rate": 0.025, "moat": "Medium-High", "description": "Pipeline templates assisted; multi-stage failure resilience requires human oversight"},
    "system architecture": {"category": "antifragile", "base_risk": 0.08, "decay_rate": 0.005, "moat": "Maximum", "description": "High-level trade-offs, fault tolerance, security boundaries, non-functional requirements"},

    # Cybersecurity & Governance (Antifragile Moat)
    "cybersecurity": {"category": "antifragile", "base_risk": 0.12, "decay_rate": 0.008, "moat": "Maximum", "description": "AI expands the attack surface; human defense & red-teaming demand accelerates"},
    "penetration testing": {"category": "antifragile", "base_risk": 0.15, "decay_rate": 0.010, "moat": "Very High", "description": "Exploit auditing and novel zero-day attack surface discovery"},
    "network security": {"category": "antifragile", "base_risk": 0.16, "decay_rate": 0.011, "moat": "Very High", "description": "Zero-trust architectures and encrypted network fabric protection"},

    # Frontier AI / ML (Direct Beneficiaries / Antifragile)
    "machine learning": {"category": "antifragile", "base_risk": 0.20, "decay_rate": 0.013, "moat": "High", "description": "Core model fundamentals, loss surfaces, empirical evaluation"},
    "deep learning": {"category": "antifragile", "base_risk": 0.16, "decay_rate": 0.011, "moat": "Very High", "description": "Neural architectures, representation learning, scaling laws"},
    "pytorch": {"category": "antifragile", "base_risk": 0.12, "decay_rate": 0.008, "moat": "Very High", "description": "Defacto framework for frontier research, training, and model development"},
    "tensorflow": {"category": "augmented", "base_risk": 0.35, "decay_rate": 0.024, "moat": "Medium", "description": "Production mobile/edge deployment; research moving heavily toward PyTorch"},
    "nlp": {"category": "antifragile", "base_risk": 0.18, "decay_rate": 0.012, "moat": "High", "description": "Tokenization, context window dynamics, language semantics"},
    "computer vision": {"category": "antifragile", "base_risk": 0.19, "decay_rate": 0.013, "moat": "High", "description": "Spatial AI, diffusion models, multimodal perception"},
    "llms / generative ai": {"category": "antifragile", "base_risk": 0.06, "decay_rate": 0.004, "moat": "Maximum", "description": "Direct driver of current technological shift; foundation model exploitation"},
    "langchain": {"category": "antifragile", "base_risk": 0.18, "decay_rate": 0.012, "moat": "High", "description": "Agent chains, memory buffers, tool usage composition"},
    "rag": {"category": "antifragile", "base_risk": 0.08, "decay_rate": 0.005, "moat": "Maximum", "description": "Enterprise knowledge grounding, retrieval accuracy, semantic reranking"},
    "prompt engineering": {"category": "augmented", "base_risk": 0.40, "decay_rate": 0.028, "moat": "Medium", "description": "Moving to programmatic optimization (DSPy); ad-hoc prompting commoditizing"},
    "vector databases": {"category": "antifragile", "base_risk": 0.10, "decay_rate": 0.007, "moat": "Maximum", "description": "High-dimensional approximate nearest neighbor indexing for enterprise AI"},
    "product management": {"category": "antifragile", "base_risk": 0.14, "decay_rate": 0.009, "moat": "Maximum", "description": "Problem discovery, customer validation, ethical alignment, product-market fit"},
}

DEFAULT_UNKNOWN_SKILL = {
    "category": "augmented",
    "base_risk": 0.40,
    "decay_rate": 0.026,
    "moat": "Medium",
    "description": "Standard technical skill; balanced AI augmentation profile",
}


# ─── 2. Shock Scenarios ────────────────────────────────────────────────────────

SCENARIOS: Dict[str, Dict[str, Any]] = {
    "baseline": {
        "id": "baseline",
        "name": "Scenario 1: Steady Tech Evolution (Conservative)",
        "badge": "🟢 Baseline",
        "multiplier": 1.0,
        "vulnerability_boost": 0.0,
        "frontier_premium": 0.10,
        "description": "Gradual 10-15% annual capability growth. Copilot assistants improve developer efficiency but do not fundamentally reshape staffing models.",
        "headline": "Modest productivity gains; existing roles evolve gracefully without sudden structural disruption.",
    },
    "agentic_breakout": {
        "id": "agentic_breakout",
        "name": "Scenario 2: Agentic SWE Breakout (Moderate Shock)",
        "badge": "🟡 Moderate Shock",
        "multiplier": 1.55,
        "vulnerability_boost": 0.28,
        "frontier_premium": 0.38,
        "description": "Autonomous coding agents (Devin/Claude Code style) reliably write boilerplate code, generate end-to-end unit tests, and resolve routine PRs.",
        "headline": "Junior task execution commoditized by ~45%; sharp surge in demand for architecture, MLOps & systems engineering.",
    },
    "autonomous_enterprise": {
        "id": "autonomous_enterprise",
        "name": "Scenario 3: Autonomous Enterprise & AGI Frontier (Black Swan)",
        "badge": "🔴 Black Swan Shock",
        "multiplier": 2.25,
        "vulnerability_boost": 0.52,
        "frontier_premium": 0.65,
        "description": "Enterprise-scale autonomous agent swarms handle the vast majority of traditional CRUD, scripting, and basic maintenance. Severe compression of entry-level coding roles.",
        "headline": "Structural disruption: Only antifragile architects, security guardians, and frontier AI specialists retain high leverage.",
    },
}


# ─── 3. Core Analytical Stress Tester ──────────────────────────────────────────

class AIStressTester:
    """
    Stress-testing engine evaluating skill half-life and career antifragility
    under AI disruption shockwaves.
    """

    def __init__(self, scenario_key: str = "agentic_breakout", shock_intensity: float = 1.0):
        self.scenario_key = scenario_key if scenario_key in SCENARIOS else "agentic_breakout"
        self.scenario = SCENARIOS[self.scenario_key]
        self.shock_intensity = max(0.5, min(2.0, float(shock_intensity)))

    def _normalize(self, skill: str) -> str:
        return skill.strip().lower()

    def get_skill_metadata(self, skill_name: str) -> Dict[str, Any]:
        norm = self._normalize(skill_name)
        if norm in SKILL_TAXONOMY:
            return SKILL_TAXONOMY[norm]
        # Partial match
        for k, v in SKILL_TAXONOMY.items():
            if k in norm or norm in k:
                return v
        return DEFAULT_UNKNOWN_SKILL

    def evaluate_skills(self, declared_skills: List[str]) -> Dict[str, Any]:
        """
        Evaluate a candidate's declared skill set against the active AI shockwave.
        """
        if not declared_skills:
            # Fallback to standard baseline portfolio if empty
            declared_skills = ["Python", "SQL", "Git"]

        effective_mult = self.scenario["multiplier"] * self.shock_intensity
        vuln_boost = self.scenario["vulnerability_boost"] * self.shock_intensity
        frontier_premium = self.scenario["frontier_premium"] * self.shock_intensity

        skill_records = []
        half_lives = []
        category_counts = {"high_vulnerability": 0, "augmented": 0, "antifragile": 0}

        for skill in declared_skills:
            meta = self.get_skill_metadata(skill)
            cat = meta["category"]
            category_counts[cat] = category_counts.get(cat, 0) + 1

            # Adjusted risk under shock
            base_risk = meta["base_risk"]
            if cat == "high_vulnerability":
                adjusted_risk = min(0.98, base_risk + vuln_boost)
                decay_rate = meta["decay_rate"] * effective_mult
            elif cat == "augmented":
                adjusted_risk = min(0.90, base_risk + (vuln_boost * 0.4))
                decay_rate = meta["decay_rate"] * (1.0 + (effective_mult - 1.0) * 0.6)
            else:  # antifragile
                adjusted_risk = max(0.04, base_risk * (1.0 - (frontier_premium * 0.5)))
                decay_rate = max(0.003, meta["decay_rate"] / (1.0 + frontier_premium))

            # Skill half-life: T_1/2 = ln(2) / decay_rate (in months)
            half_life_months = math.log(2.0) / max(0.005, decay_rate)
            half_lives.append(half_life_months)

            skill_records.append({
                "skill": skill,
                "category": cat,
                "category_label": {
                    "high_vulnerability": "🔴 High Vulnerability",
                    "augmented": "🟡 AI-Augmented",
                    "antifragile": "🟢 Antifragile / Frontier",
                }[cat],
                "base_risk": round(base_risk * 100, 1),
                "shock_risk": round(adjusted_risk * 100, 1),
                "half_life_months": round(half_life_months, 1),
                "moat": meta["moat"],
                "description": meta["description"],
            })

        # Overall Portfolio Metrics
        total_skills = len(skill_records)
        avg_risk = sum(r["shock_risk"] for r in skill_records) / max(1, total_skills)
        # Portfolio aggregate half-life (harmonic-mean-leaning to respect weakest links)
        portfolio_half_life = sum(half_lives) / max(1, total_skills)

        # Antifragility Score calculation (0 - 100)
        # Antifragility increases with antifragile ratio, decreases with high vulnerability ratio
        antifragile_ratio = category_counts.get("antifragile", 0) / max(1, total_skills)
        vuln_ratio = category_counts.get("high_vulnerability", 0) / max(1, total_skills)
        augmented_ratio = category_counts.get("augmented", 0) / max(1, total_skills)

        raw_score = 100.0 - (avg_risk * 0.85) + (antifragile_ratio * 25.0) - (vuln_ratio * 15.0)
        antifragility_score = max(5.0, min(99.0, raw_score))

        # Tier assignment
        if antifragility_score >= 80:
            tier_label = "🛡️ Antifragile (Frontier Leader)"
            tier_color = "#10B981"
            tier_summary = "Your skillset naturally benefits from increased AI automation. You focus on high-leverage systems and frontier domains."
        elif antifragility_score >= 60:
            tier_label = "⚖️ Resilient (Augmented Producer)"
            tier_color = "#06B6D4"
            tier_summary = "You are well-positioned with solid engineering foundations, but some routine syntax and tools will require active upskilling."
        elif antifragility_score >= 40:
            tier_label = "⚠️ Vulnerable (Moderate Exposure)"
            tier_color = "#F59E0B"
            tier_summary = "A notable portion of your daily tools face aggressive automation. Pivot toward system architecture and AI orchestration."
        else:
            tier_label = "🚨 High Displacement Risk"
            tier_color = "#EF4444"
            tier_summary = "Heavy concentration in commoditized syntax or boilerplate tasks. Urgent upskilling in frontier or cloud architecture recommended."

        return {
            "skills": skill_records,
            "portfolio_half_life_months": round(portfolio_half_life, 1),
            "antifragility_score": round(antifragility_score, 1),
            "tier_label": tier_label,
            "tier_color": tier_color,
            "tier_summary": tier_summary,
            "category_breakdown": {
                "high_vulnerability": category_counts["high_vulnerability"],
                "augmented": category_counts["augmented"],
                "antifragile": category_counts["antifragile"],
            },
            "antifragile_ratio_pct": round(antifragile_ratio * 100, 1),
            "vulnerability_ratio_pct": round(vuln_ratio * 100, 1),
            "scenario": self.scenario,
            "shock_intensity": self.shock_intensity,
        }

    def stress_test_roles(
        self,
        recommendations: List[Dict[str, Any]],
        declared_skills: List[str],
    ) -> List[Dict[str, Any]]:
        """
        Re-evaluates role recommendations under the AI shock scenario.
        Computes the 'Shock Delta': which roles gain ground vs lose ground.
        """
        if not recommendations:
            return []

        effective_mult = self.scenario["multiplier"] * self.shock_intensity
        frontier_premium = self.scenario["frontier_premium"] * self.shock_intensity
        vuln_boost = self.scenario["vulnerability_boost"] * self.shock_intensity

        stressed_roles = []
        for rank_idx, rec in enumerate(recommendations, start=1):
            role_entry = rec.get("role_entry", {})
            orig_score = float(rec.get("final_score", 0.5))
            role_name = rec.get("role_name", role_entry.get("role_name", "Unknown"))

            # Inspect role's skill frontier profile
            required_skills = role_entry.get("required_skills", [])
            frontier_skills = role_entry.get("frontier_skills", [])
            frontier_ratio = float(role_entry.get("li_frontier_skill_ratio", 0.2))

            # Role vulnerability calculation based on required skills
            role_vuln_sum = 0.0
            for s in (required_skills or ["Python"]):
                m = self.get_skill_metadata(s)
                role_vuln_sum += m["base_risk"]
            role_avg_vuln = role_vuln_sum / max(1, len(required_skills))

            # Shock Adjustment Factor:
            # Roles with high frontier skills and low boilerplate get a boost.
            # Roles with high routine tasks and low frontier skills get penalized.
            shock_factor = 1.0 + (frontier_ratio * frontier_premium * 1.5) - (role_avg_vuln * vuln_boost * 0.9)
            shocked_score = min(0.99, max(0.10, orig_score * shock_factor))

            stressed_roles.append({
                "original_rank": rank_idx,
                "role_id": rec.get("role_id", role_entry.get("role_id")),
                "role_name": role_name,
                "original_score": round(orig_score * 100, 1),
                "shocked_score": round(shocked_score * 100, 1),
                "score_delta": round((shocked_score - orig_score) * 100, 1),
                "shock_factor": round(shock_factor, 2),
                "frontier_ratio_pct": round(frontier_ratio * 100, 1),
                "role_vulnerability_pct": round(role_avg_vuln * 100, 1),
                "classification": role_entry.get("classification", "Unknown"),
                "rec_ref": rec,
            })

        # Re-rank based on shocked score
        stressed_roles.sort(key=lambda x: x["shocked_score"], reverse=True)
        for new_rank, r in enumerate(stressed_roles, start=1):
            r["post_shock_rank"] = new_rank
            r["rank_change"] = r["original_rank"] - new_rank  # positive = climbed up
            if r["rank_change"] > 0:
                r["momentum"] = f"⬆️ Climbed +{r['rank_change']}"
                r["momentum_type"] = "positive"
            elif r["rank_change"] < 0:
                r["momentum"] = f"⬇️ Dropped {r['rank_change']}"
                r["momentum_type"] = "negative"
            else:
                r["momentum"] = "⏺️ Stable (Rank Preserved)"
                r["momentum_type"] = "neutral"

        return stressed_roles

    def prescribe_antifragility_vaccine(
        self,
        current_skills: List[str],
        candidate_pool: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Greedy simulation: Identifies the top 3 highest-leverage skills to learn
        that maximize the candidate's Antifragility Score and extend Skill Half-Life.
        """
        if candidate_pool is None:
            candidate_pool = [
                "System Architecture",
                "RAG",
                "Kubernetes",
                "Vector Databases",
                "LLMs / Generative AI",
                "Cybersecurity",
                "PyTorch",
                "Terraform",
                "DevOps",
            ]

        curr_normalized = {self._normalize(s) for s in current_skills}
        base_eval = self.evaluate_skills(current_skills)
        base_score = base_eval["antifragility_score"]
        base_hl = base_eval["portfolio_half_life_months"]

        recommendations = []
        for cand in candidate_pool:
            if self._normalize(cand) in curr_normalized:
                continue

            simulated = list(current_skills) + [cand]
            sim_eval = self.evaluate_skills(simulated)
            delta_score = sim_eval["antifragility_score"] - base_score
            delta_hl = sim_eval["portfolio_half_life_months"] - base_hl

            meta = self.get_skill_metadata(cand)
            recommendations.append({
                "skill": cand,
                "score_boost": round(delta_score, 1),
                "half_life_extension_months": round(max(0.1, delta_hl), 1),
                "new_antifragility": round(sim_eval["antifragility_score"], 1),
                "moat": meta["moat"],
                "description": meta["description"],
            })

        recommendations.sort(key=lambda x: x["score_boost"], reverse=True)
        return recommendations[:3]
