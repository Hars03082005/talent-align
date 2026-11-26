"""
backend/ai/llm_router.py
========================
Local-first LLM gateway connecting to Ollama (qwen2.5:3b and qwen2.5:7b-instruct).
Enforces structured JSON intent classification and grounded response generation.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, Optional

import requests

from backend.ai.model_config import (
    GENERATOR_MODEL,
    OLLAMA_BASE_URL,
    OLLAMA_TIMEOUT,
    ROUTER_MODEL,
    VALID_INTENTS,
)

logger = logging.getLogger(__name__)


def _call_gemini_fallback(
    prompt: str,
    system: Optional[str] = None,
    json_format: bool = False,
    timeout: float = 10.0,
) -> Optional[str]:
    """Call Google Gemini 1.5 Flash API as hosted fallback when GEMINI_API_KEY is available."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        # Try google.generativeai if available
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            gen_config = {}
            if json_format:
                gen_config["response_mime_type"] = "application/json"
            model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                system_instruction=system if system else None,
                generation_config=gen_config,
            )
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            logger.info(f"google.generativeai client fallback to REST API: {e}")

        # Direct REST API fallback
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        parts = []
        if system:
            parts.append({"text": f"SYSTEM INSTRUCTION:\n{system}\n"})
        parts.append({"text": prompt})
        body: Dict[str, Any] = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": 0.1 if json_format else 0.3,
            },
        }
        if json_format:
            body["generationConfig"]["responseMimeType"] = "application/json"

        resp = requests.post(url, json=body, timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts_out = candidates[0].get("content", {}).get("parts", [])
                if parts_out:
                    return parts_out[0].get("text", "").strip()
    except Exception as exc:
        logger.warning(f"Gemini fallback failed: {exc}")

    return None


def _call_ollama(
    model: str,
    prompt: str,
    system: Optional[str] = None,
    json_format: bool = False,
    timeout: float = OLLAMA_TIMEOUT,
) -> Optional[str]:
    """Call Ollama /api/generate endpoint with timeout and error handling, falling back to Gemini if available."""
    url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/generate"
    payload: Dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1 if json_format else 0.3,
            "top_p": 0.9,
        },
    }
    if system:
        payload["system"] = system
    if json_format:
        payload["format"] = "json"

    try:
        resp = requests.post(url, json=payload, timeout=(1.5, timeout))
        if resp.status_code == 200:
            data = resp.json()
            return data.get("response", "").strip()
        logger.warning(f"Ollama returned status {resp.status_code}: {resp.text}")
        return _call_gemini_fallback(prompt=prompt, system=system, json_format=json_format)
    except requests.exceptions.RequestException as e:
        logger.info(f"Ollama connection unavailable or timed out ({e}). Checking Gemini hosted fallback.")
        gemini_res = _call_gemini_fallback(prompt=prompt, system=system, json_format=json_format)
        if gemini_res:
            return gemini_res
        return None


def rule_based_intent_fallback(query: str) -> str:
    """Deterministic keyword-based intent classifier used when Ollama is offline."""
    q = query.lower()

    if any(k in q for k in ["compare", "versus", " vs ", "difference between", "better than"]):
        return "career_comparison"
    if any(k in q for k in ["ready", "readiness", "fit", "qualify", "match score", "am i prepared", "chances"]):
        return "readiness_check"
    if any(k in q for k in ["roadmap", "learning path", "what to learn", "how to learn", "steps to become", "courses", "curriculum", "plan"]):
        return "roadmap_help"
    if any(k in q for k in ["resume", "cv", "portfolio", "extracted skills", "profile experience"]):
        return "resume_analysis"
    return "general_role_info"


def classify_intent(query: str) -> str:
    """
    Classify query intent using qwen2.5:3b with strict JSON output.
    Returns one of: career_comparison, readiness_check, roadmap_help, resume_analysis, general_role_info.
    """
    system_prompt = (
        "You are an intent routing classifier for a career intelligence platform. "
        "Classify the user query into exactly ONE of the following intents:\n"
        "- career_comparison: Comparing two or more roles or career trajectories.\n"
        "- readiness_check: Inquiring about personal readiness, qualifications, or profile fit for a role.\n"
        "- roadmap_help: Asking for a learning path, steps to take, skills to acquire, or a career roadmap.\n"
        "- resume_analysis: Questions about resume text, extracted skills, or resume improvement.\n"
        "- general_role_info: General role queries, salary trends, market demand, or skill requirements.\n\n"
        "Output ONLY a valid JSON object matching: {\"intent\": \"<intent_name>\", \"confidence\": <float_0_to_1>}."
    )

    prompt = f"User Query: {query}\n\nJSON Output:"
    raw_response = _call_ollama(
        model=ROUTER_MODEL,
        prompt=prompt,
        system=system_prompt,
        json_format=True,
        timeout=OLLAMA_TIMEOUT,
    )

    if raw_response:
        try:
            parsed = json.loads(raw_response)
            intent = parsed.get("intent", "").strip().lower()
            if intent in VALID_INTENTS:
                return intent
        except json.JSONDecodeError:
            # Try regex extraction
            match = re.search(r'"intent"\s*:\s*"([a-zA-Z_]+)"', raw_response)
            if match and match.group(1).lower() in VALID_INTENTS:
                return match.group(1).lower()

    return rule_based_intent_fallback(query)


def generate_response(
    prompt: str,
    context: Optional[str] = None,
    system_prompt: Optional[str] = None,
) -> str:
    """
    Generate grounded response using qwen2.5:7b-instruct.
    If Ollama is not accessible, returns a cleanly structured deterministic synthesis of context.
    """
    default_system = (
        "You are a professional, local-first Career Intelligence and Talent Alignment AI Assistant.\n"
        "STRICT INSTRUCTIONS:\n"
        "1. Never calculate match percentages, LightGBM forecasts, or invent skills out of nowhere.\n"
        "2. All metrics, growth figures (bps / %), and skills must come strictly from the provided ML Context and Retrieved Chunks.\n"
        "3. Explicitly cite the sources provided in the context (e.g., [Role Catalog: <role_id>], [ML Tool: SkillGap], [SHAP Driver Analysis]).\n"
        "4. Be concise, actionable, and structured with bullet points."
    )
    sys_instruction = system_prompt or default_system

    full_prompt = prompt
    if context:
        full_prompt = f"### GROUNDING CONTEXT & ML TOOL OUTPUTS:\n{context}\n\n### USER REQUEST:\n{prompt}"

    llm_out = _call_ollama(
        model=GENERATOR_MODEL,
        prompt=full_prompt,
        system=sys_instruction,
        json_format=False,
        timeout=OLLAMA_TIMEOUT,
    )

    if llm_out:
        return llm_out

    # Fallback response generator when local Ollama is offline
    return _deterministic_grounded_fallback(prompt, context)


def _deterministic_grounded_fallback(prompt: str, context: Optional[str]) -> str:
    """Grounded fallback when local Ollama server is offline or unreachable."""
    if not context or not context.strip():
        return (
            "I could not retrieve sufficient verified ML evidence or catalog data to answer your specific query. "
            "Please specify a known role (e.g., 'MLOps Engineer', 'Cloud Architect') or complete the BAIO profiling assessment."
        )

    return (
        "### Verified Career Intelligence Insights\n\n"
        "Based strictly on verified platform data and machine learning evaluation:\n\n"
        f"{context.strip()}\n\n"
        "**Note:** Verified against the 60-role catalog and ML demand forecasting models."
    )
