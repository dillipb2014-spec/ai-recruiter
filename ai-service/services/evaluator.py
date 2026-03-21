import json
import os
import asyncio
from typing import Optional
from services.litellm_client import litellm_generate, SYSTEM_PROMPT
from services.prompt_builder import build_evaluation_prompt, build_final_scorecard_prompt

# Dimension weights must sum to 1.0
WEIGHTS = {"relevance": 0.35, "technical_knowledge": 0.40, "communication_clarity": 0.25}


async def evaluate_answer(question: str, transcript: str, job_role: str) -> dict:
    """Score a single answer across all 3 dimensions."""
    if not transcript.strip():
        return _empty_scores("No answer provided.")

    prompt = build_evaluation_prompt(question, transcript, job_role)
    raw = await _chat(prompt)
    data = _parse_json(raw)

    relevance   = _clamp(data["relevance"]["score"])
    technical   = _clamp(data["technical_knowledge"]["score"])
    clarity     = _clamp(data["communication_clarity"]["score"])
    weighted    = round(
        relevance * WEIGHTS["relevance"]
        + technical * WEIGHTS["technical_knowledge"]
        + clarity   * WEIGHTS["communication_clarity"],
        2,
    )

    return {
        "relevance":             relevance,
        "technical_knowledge":   technical,
        "communication_clarity": clarity,
        "weighted_score":        weighted,
        "relevance_reasoning":             data["relevance"]["reasoning"],
        "technical_knowledge_reasoning":   data["technical_knowledge"]["reasoning"],
        "communication_clarity_reasoning": data["communication_clarity"]["reasoning"],
        "strengths":        data.get("strengths", []),
        "weaknesses":       data.get("weaknesses", []),
        "overall_feedback": data.get("overall_feedback", ""),
    }


async def evaluate_all_answers(responses: list[dict], job_role: str) -> list[dict]:
    """Evaluate all answers concurrently."""
    tasks = [
        evaluate_answer(r["question_text"], r["transcript"] or "", job_role)
        for r in responses
    ]
    results = await asyncio.gather(*tasks)
    return [{"question": r["question_text"], **score} for r, score in zip(responses, results)]


async def build_scorecard(evaluations: list[dict], job_role: str, candidate_details: dict = None) -> dict:
    """Generate final hiring scorecard from all evaluated answers."""
    prompt = build_final_scorecard_prompt(job_role, evaluations, candidate_details)
    raw    = await _chat(prompt)
    data   = _parse_json(raw)

    return {
        "overall_score":      _clamp(data.get("overall_score", 0)),
        "ai_recommendation":  data.get("ai_recommendation", "hold"),
        "strengths":          data.get("strengths", []),
        "weaknesses":         data.get("weaknesses", []),
        "ai_feedback":        data.get("ai_feedback", ""),
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _chat(user_prompt: str) -> str:
    return await litellm_generate(user_prompt, system=SYSTEM_PROMPT)


def _parse_json(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}\nRaw: {raw}")


def _clamp(value) -> float:
    return round(max(0.0, min(100.0, float(value))), 2)


def _empty_scores(reason: str) -> dict:
    return {
        "relevance": 0, "technical_knowledge": 0, "communication_clarity": 0,
        "weighted_score": 0,
        "relevance_reasoning": reason, "technical_knowledge_reasoning": reason,
        "communication_clarity_reasoning": reason,
        "strengths": [], "weaknesses": [], "overall_feedback": reason,
    }
