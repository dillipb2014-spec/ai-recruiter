import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.db import get_pool
from services.litellm_client import litellm_generate, _sanitize
ollama_generate = litellm_generate

router = APIRouter(prefix="/screening-test", tags=["screening-test"])


class EvaluateRequest(BaseModel):
    answers: list[dict]  # [{ question: str, answer: str }]


@router.get("/{candidate_id}/questions")
async def get_screening_questions(candidate_id: str):
    pool = await get_pool()

    row = await pool.fetchrow(
        """SELECT jr.title, jr.original_jd_text, jr.key_points, jr.mandatory_skills,
                  COALESCE(r.experience_years, 0) AS experience_years
           FROM candidates c
           LEFT JOIN job_roles jr ON jr.id = c.job_role_id
           LEFT JOIN LATERAL (
             SELECT experience_years FROM resumes WHERE candidate_id = c.id
             ORDER BY created_at DESC LIMIT 1
           ) r ON true
           WHERE c.id = $1""",
        candidate_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job_title        = row["title"] or "Software Engineer"
    jd_text          = _sanitize(row["original_jd_text"] or "", 2000)
    experience_years = float(row["experience_years"] or 0)
    is_senior        = experience_years > 3

    key_points = row["key_points"] or []
    if isinstance(key_points, str):
        key_points = json.loads(key_points)

    mandatory = row["mandatory_skills"] or []
    if isinstance(mandatory, str):
        mandatory = json.loads(mandatory)

    seniority_instruction = (
        f"The candidate has {experience_years} years of experience — treat them as SENIOR LEVEL. "
        "Questions must be deep, nuanced, and expect expert-level answers covering trade-offs, "
        "architecture decisions, and real-world production experience."
        if is_senior else
        f"The candidate has {experience_years} years of experience — treat them as JUNIOR/MID LEVEL. "
        "Questions should test foundational understanding and practical application."
    )

    role_topics = {
        "SRE": ["Infrastructure & Reliability", "Monitoring & Observability", "Incident Management", "Kubernetes & Containerization", "High Availability & Fault Tolerance"],
        "Frontend": ["React/Vue/Angular", "JavaScript/TypeScript", "Performance Optimization", "State Management", "Component Architecture"],
        "Backend": ["API Design", "Database Optimization", "Microservices", "Authentication & Security", "Caching Strategies"],
        "Full Stack": ["Frontend Development", "Backend Development", "Database Design", "API Integration", "DevOps Basics"],
        "DevOps": ["CI/CD Pipelines", "Infrastructure as Code", "Container Orchestration", "Cloud Services", "Automation"],
        "Data Engineer": ["ETL Pipelines", "Data Modeling", "Big Data Technologies", "SQL Optimization", "Data Warehousing"],
    }
    
    topics = next(
        (v for k, v in role_topics.items() if k.lower() in job_title.lower()),
        role_topics["Backend"]
    )
    
    prompt = f"""You are a technical recruiter at Juspay generating a screening test for: {job_title}.

JOB DESCRIPTION:
{jd_text or "Not provided."}

KEY RESPONSIBILITIES:
{chr(10).join(f"- {kp}" for kp in key_points)}

MANDATORY SKILLS: {", ".join(mandatory) if mandatory else "None specified"}

CANDIDATE SENIORITY: {seniority_instruction}

TECHNICAL DOMAINS TO TEST:
{chr(10).join(f"- {t}" for t in topics)}

Generate exactly 5 technical screening questions SPECIFIC to this {job_title} role:
- Questions must directly relate to the job description, key responsibilities, and mandatory skills above.
- Each question should test practical knowledge relevant to {job_title} work.
- Do NOT ask generic software questions — every question must be specific to {job_title}.
- Each question should be answerable in 2-4 sentences.
- Do NOT ask for code.
- {"Senior-level: expect trade-offs, architectural depth, and production experience." if is_senior else "Junior/Mid-level: test foundational understanding and practical application."}

Respond with ONLY this JSON:
{{"questions": ["<q1>", "<q2>", "<q3>", "<q4>", "<q5>"]}}"""

    try:
        raw  = await ollama_generate(prompt)
        raw  = re.sub(r"```(?:json)?|```", "", raw).strip()
        data = json.loads(raw)
        questions = data.get("questions", [])[:5]
    except Exception as e:
        print(f"WARNING: Question generation failed: {e} — using fallback questions")
        level = "Senior-level" if is_senior else "Mid-level"
        questions = [
            f"[{level}] Describe your experience with {topics[0]}. What challenges have you faced?",
            f"[{level}] How do you approach {topics[1]} in your role as {job_title}?",
            f"[{level}] Walk me through a time you handled {topics[2]}. What was the outcome?",
            f"[{level}] What tools and techniques do you use for {topics[3]}?",
            f"[{level}] How do you ensure {topics[4]} in your projects?",
        ]

    return {"candidate_id": candidate_id, "job_title": job_title, "is_senior": is_senior, "experience_years": experience_years, "questions": questions}


@router.post("/{candidate_id}/evaluate")
async def evaluate_screening_test(candidate_id: str, req: EvaluateRequest):
    pool = await get_pool()

    row = await pool.fetchrow(
        """SELECT c.id, jr.title, jr.original_jd_text, jr.mandatory_skills,
                  r.ai_score AS resume_score
           FROM candidates c
           LEFT JOIN job_roles jr ON jr.id = c.job_role_id
           LEFT JOIN LATERAL (
             SELECT ai_score FROM resumes WHERE candidate_id = c.id
             ORDER BY created_at DESC LIMIT 1
           ) r ON true
           WHERE c.id = $1""",
        candidate_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job_title   = row["title"] or "Software Engineer"
    jd_text     = _sanitize(row["original_jd_text"] or "", 1500)
    resume_score_final = float(row["resume_score"] or 0)

    mandatory = row["mandatory_skills"] or []
    if isinstance(mandatory, str):
        mandatory = json.loads(mandatory)

    qa_text = "\n".join(
        f"Q{i+1}: {qa['question']}\nA{i+1}: {qa['answer']}"
        for i, qa in enumerate(req.answers)
    )

    prompt = f"""You are evaluating screening test answers for a {job_title} role at Juspay.

JOB DESCRIPTION:
{jd_text or "Not provided."}

MANDATORY SKILLS: {", ".join(mandatory) if mandatory else "None"}

CANDIDATE ANSWERS:
{qa_text}

Scoring rules:
- Score each answer out of 10. total_score = sum of all 5 scores (max 100).
- Do NOT reference resume score.
- If total_score >= 50 → decision = "SCREEN SELECT", else "SCREEN REJECT".

Respond with ONLY this JSON:
{{
  "total_score": <0-100 integer>,
  "decision": "SCREEN SELECT" | "SCREEN REJECT",
  "question_scores": [
    {{"index": 1, "score": <0-10>, "question": "<question text>", "answer": "<one sentence eval of the answer>"}},
    {{"index": 2, "score": <0-10>, "question": "<question text>", "answer": "<one sentence eval of the answer>"}},
    {{"index": 3, "score": <0-10>, "question": "<question text>", "answer": "<one sentence eval of the answer>"}},
    {{"index": 4, "score": <0-10>, "question": "<question text>", "answer": "<one sentence eval of the answer>"}},
    {{"index": 5, "score": <0-10>, "question": "<question text>", "answer": "<one sentence eval of the answer>"}}
  ],
  "summary": "<one sentence overall summary>"
}}"""

    try:
        raw  = await ollama_generate(prompt)
        raw  = re.sub(r"```(?:json)?|```", "", raw).strip()
        data = json.loads(raw)
    except Exception as e:
        print(f"WARNING: Test evaluation failed: {e}")
        data = {}

    ai_total_score = max(0.0, min(100.0, float(data.get("total_score", 50))))
    per_q = data.get("question_scores", [])
    # Merge actual candidate answers into per_q
    for i, qa in enumerate(req.answers):
        if i < len(per_q):
            per_q[i]["candidate_answer"] = qa.get("answer", "")
    # Fallback: build from req.answers if LLM didn't return question_scores
    if not per_q:
        per_q = [{"index": i+1, "score": round(ai_total_score/5, 1), "question": qa["question"], "answer": "", "candidate_answer": qa.get("answer", "")} for i, qa in enumerate(req.answers)]
    ai_reasoning = data.get("summary", "") or str(data.get("reasoning", "")).replace("/50", "/100")

    screening_score_final = ai_total_score

    # Step 1: Add Resume + Screening. Step 2: Divide by 2.
    final_score = round((resume_score_final + screening_score_final) / 2, 2)

    if final_score >= 50:
        new_status = "screen_select"
        recommendation = "hire"
        verdict = "Recommended"
    else:
        new_status = "screen_reject"
        recommendation = "reject"
        verdict = "Not Recommended"

    warning = (
        " Note: Candidate's theoretical experience significantly outweighs test performance."
        if (resume_score_final - screening_score_final) > 20 else ""
    )

    insight = f"Final Suitability Score: {final_score:.2f}% ({verdict})"

    # Persist to evaluation_scores
    await pool.execute(
        """INSERT INTO evaluation_scores
             (candidate_id, resume_score, overall_score, ai_feedback, ai_recommendation, question_scores)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (candidate_id) DO UPDATE SET
             overall_score     = EXCLUDED.overall_score,
             ai_feedback       = EXCLUDED.ai_feedback,
             ai_recommendation = EXCLUDED.ai_recommendation,
             question_scores   = EXCLUDED.question_scores""",
        candidate_id,
        resume_score_final,
        final_score,
        ai_reasoning,
        recommendation,
        json.dumps(per_q),
    )

    await pool.execute(
        "UPDATE candidates SET status = $1, ai_decision_insight = $2 WHERE id = $3",
        new_status, insight, candidate_id,
    )

    return {
        "candidate_id":      candidate_id,
        "resume_score":      resume_score_final,
        "screening_score":   screening_score_final,
        "final_score":       final_score,
        "status":            new_status,
        "ai_feedback":       ai_reasoning,
        "recommendation":    recommendation,
    }
