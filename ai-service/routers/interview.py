import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.db import get_pool
from services.audio_extractor import extract_audio
from services.transcriber import transcribe
from services.evaluator import evaluate_answer
from services.litellm_client import litellm_generate, _sanitize
ollama_generate = litellm_generate

router = APIRouter(prefix="/interview", tags=["interview"])


class QuestionsRequest(BaseModel):
    interview_id: str
    job_role: str
    job_description: str = ""
    job_requirements: str = ""


class ProcessResponseRequest(BaseModel):
    response_id: str
    interview_id: str
    video_path: str
    question_index: int


@router.post("/questions")
async def generate_questions(req: QuestionsRequest):
    job_role    = _sanitize(req.job_role, 100)
    description = _sanitize(req.job_description, 1000)
    requirements = _sanitize(req.job_requirements, 1000)

    # Juspay UI Developer role — use curated question bank
    ui_roles = ["ui", "frontend", "design engineer", "ui developer"]
    is_ui_role = any(kw in job_role.lower() for kw in ui_roles)

    if is_ui_role:
        questions = [
            "What is the difference between a functional UI and a delightful UI? Give an example from your own work.",
            "How do you handle performance bottlenecks in a complex React + Redux application with many re-renders?",
            "Walk me through your Figma-to-code workflow. How do you ensure pixel-perfect implementation?",
            "How do you proactively identify UI/UX issues before they reach users or QA?",
            "Describe a micro-interaction you designed or built that meaningfully improved the user experience.",
        ]
    else:
        prompt = f"""Generate exactly 5 interview questions for a {job_role} position.
Job Description: {description}\nRequirements: {requirements}
Rules: mix behavioural and technical, concise (1-2 sentences each), relevant to the role.
Respond with ONLY this JSON: {{"questions": ["q1", "q2", "q3", "q4", "q5"]}}"""

        try:
            raw  = await ollama_generate(prompt)
            data = json.loads(raw)
            questions = data.get("questions", [])[:5]
        except Exception:
            questions = [
                f"Tell me about yourself and your experience relevant to the {req.job_role} role.",
                "What are your strongest technical skills for this position?",
                "Describe a challenging project and how you overcame obstacles.",
                "How do you stay current with industry trends and technologies?",
                "Where do you see yourself professionally in the next 3 years?",
            ]

    return {"interview_id": req.interview_id, "questions": questions}


@router.post("/process-response")
async def process_response(req: ProcessResponseRequest):
    pool = await get_pool()

    # Mark as processing
    await pool.execute(
        "UPDATE interview_responses SET transcript_status = 'processing' WHERE id = $1",
        req.response_id,
    )

    audio_path = None
    try:
        # 1. Extract audio from video
        audio_path = await extract_audio(req.video_path)

        # 2. Transcribe
        transcript_result = await transcribe(audio_path)
        transcript_text   = transcript_result["text"]

        # 3. Fetch question text + job role
        row = await pool.fetchrow(
            """SELECT ir.question_text, i.job_role
               FROM interview_responses ir
               JOIN interviews i ON i.id = ir.interview_id
               WHERE ir.id = $1""",
            req.response_id,
        )
        if not row:
            raise ValueError("Response record not found")

        # 4. Evaluate answer
        evaluation = await evaluate_answer(row["question_text"], transcript_text, row["job_role"])

        # 5. Persist transcript + scores back to interview_responses
        await pool.execute(
            """UPDATE interview_responses
               SET transcript        = $1,
                   audio_path        = $2,
                   transcript_status = 'completed'
               WHERE id = $3""",
            transcript_text,
            audio_path,
            req.response_id,
        )

        # 6. Upsert per-response evaluation into evaluation_scores
        interview_row = await pool.fetchrow(
            "SELECT candidate_id FROM interviews WHERE id = $1", req.interview_id
        )
        candidate_id = interview_row["candidate_id"]

        await pool.execute(
            """INSERT INTO evaluation_scores
                 (candidate_id, interview_id, technical_score, communication_score,
                  confidence_score, overall_score, strengths, weaknesses, ai_feedback)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (candidate_id, interview_id) DO UPDATE SET
                 technical_score     = GREATEST(evaluation_scores.technical_score,     EXCLUDED.technical_score),
                 communication_score = GREATEST(evaluation_scores.communication_score, EXCLUDED.communication_score),
                 confidence_score    = GREATEST(evaluation_scores.confidence_score,    EXCLUDED.confidence_score),
                 overall_score       = GREATEST(evaluation_scores.overall_score,       EXCLUDED.overall_score)""",
            candidate_id,
            req.interview_id,
            evaluation["technical_knowledge"],
            evaluation["communication_clarity"],
            evaluation["relevance"],
            evaluation["weighted_score"],
            json.dumps(evaluation.get("strengths", [])),
            json.dumps(evaluation.get("weaknesses", [])),
            evaluation.get("overall_feedback", ""),
        )

        return {"status": "completed", "response_id": req.response_id, "transcript": transcript_text}

    except Exception as e:
        await pool.execute(
            "UPDATE interview_responses SET transcript_status = 'failed' WHERE id = $1",
            req.response_id,
        )
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp audio file
        if audio_path and os.path.exists(audio_path):
            try:
                os.unlink(audio_path)
            except Exception:
                pass


@router.get("/status/{interview_id}")
async def get_interview_status(interview_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT question_index, transcript_status, transcript
           FROM interview_responses WHERE interview_id = $1 ORDER BY question_index""",
        interview_id,
    )
    return {"responses": [dict(r) for r in rows]}
