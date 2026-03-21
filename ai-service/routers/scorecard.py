from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.db import get_pool
from services.scorer import aggregate_interview_scores, compute_overall_score, derive_recommendation
from services.prompt_builder import build_final_scorecard_prompt, SYSTEM_PROMPT
import os, json
from openai import AsyncOpenAI

router = APIRouter(prefix="/scorecard", tags=["scorecard"])

_client: Optional[AsyncOpenAI] = None

def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        _client = AsyncOpenAI(api_key=api_key)
    return _client


class ScorecardRequest(BaseModel):
    candidate_id: str
    interview_id: str


async def _fetch_resume_score(pool, candidate_id: str) -> float:
    row = await pool.fetchrow(
        "SELECT ai_score FROM resumes WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1",
        candidate_id,
    )
    if not row or row["ai_score"] is None:
        raise HTTPException(404, "Resume score not found — run resume screening first")
    return float(row["ai_score"])


async def _fetch_interview_responses(pool, interview_id: str) -> list[dict]:
    rows = await pool.fetch(
        """SELECT ir.question_text, ir.transcript,
                  es.technical_score, es.communication_score, es.confidence_score
           FROM interview_responses ir
           LEFT JOIN evaluation_scores es ON es.interview_id = ir.interview_id
                                         AND es.candidate_id = (
                                               SELECT candidate_id FROM interviews WHERE id = $1
                                             )
           WHERE ir.interview_id = $1
           ORDER BY ir.question_index""",
        interview_id,
    )
    if not rows:
        raise HTTPException(404, "No interview responses found for this interview")
    return [dict(r) for r in rows]


async def _call_llm(job_role: str, evaluations: list[dict]) -> dict:
    prompt = build_final_scorecard_prompt(job_role, evaluations)
    response = await _get_client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.2,
        max_tokens=1024,
        timeout=30.0,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


@router.post("/generate")
async def generate_scorecard(req: ScorecardRequest):
    pool = await get_pool()

    # 1. Fetch interview metadata
    interview = await pool.fetchrow(
        "SELECT job_role, candidate_id FROM interviews WHERE id = $1", req.interview_id
    )
    if not interview:
        raise HTTPException(404, "Interview not found")

    # 2. Fetch component scores
    resume_score = await _fetch_resume_score(pool, req.candidate_id)
    responses    = await _fetch_interview_responses(pool, req.interview_id)

    # 3. Aggregate interview dimension scores
    interview_scores = aggregate_interview_scores(responses)

    # 4. Compute weighted overall score
    overall_score = compute_overall_score(
        resume_score=resume_score,
        **interview_scores,
    )
    recommendation = derive_recommendation(overall_score)

    # 5. LLM narrative feedback
    evaluations = [
        {
            "question":             r["question_text"],
            "relevance":            r.get("technical_score", 0),
            "technical_knowledge":  r.get("technical_score", 0),
            "communication_clarity": r.get("communication_score", 0),
        }
        for r in responses
    ]
    llm_result = await _call_llm(interview["job_role"], evaluations)

    # 6. Persist scorecard
    await pool.execute(
        """INSERT INTO evaluation_scores
             (candidate_id, interview_id, resume_score, technical_score,
              communication_score, confidence_score, overall_score,
              strengths, weaknesses, ai_recommendation, ai_feedback)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (candidate_id, interview_id)
           DO UPDATE SET
             overall_score    = EXCLUDED.overall_score,
             ai_recommendation = EXCLUDED.ai_recommendation,
             ai_feedback      = EXCLUDED.ai_feedback,
             evaluated_at     = NOW()""",
        req.candidate_id,
        req.interview_id,
        resume_score,
        interview_scores["technical_score"],
        interview_scores["communication_score"],
        interview_scores["confidence_score"],
        overall_score,
        json.dumps(llm_result.get("strengths", [])),
        json.dumps(llm_result.get("weaknesses", [])),
        recommendation,
        llm_result.get("ai_feedback", ""),
    )

    # 7. Update candidate pipeline status
    await pool.execute(
        "UPDATE candidates SET status = 'evaluated' WHERE id = $1", req.candidate_id
    )

    return {
        "candidate_id":       req.candidate_id,
        "interview_id":       req.interview_id,
        "resume_score":       resume_score,
        "technical_score":    interview_scores["technical_score"],
        "communication_score": interview_scores["communication_score"],
        "confidence_score":   interview_scores["confidence_score"],
        "overall_score":      overall_score,
        "ai_recommendation":  recommendation,
        "strengths":          llm_result.get("strengths", []),
        "weaknesses":         llm_result.get("weaknesses", []),
        "ai_feedback":        llm_result.get("ai_feedback", ""),
    }


@router.get("/{candidate_id}")
async def get_scorecard(candidate_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        """SELECT es.*, c.full_name, c.email, i.job_role
           FROM evaluation_scores es
           JOIN candidates c ON c.id = es.candidate_id
           LEFT JOIN interviews i ON i.id = es.interview_id
           WHERE es.candidate_id = $1
           ORDER BY es.evaluated_at DESC LIMIT 1""",
        candidate_id,
    )
    if not row:
        raise HTTPException(404, "Scorecard not found")
    return dict(row)
