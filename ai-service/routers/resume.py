import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.pdf_extractor import extract_text
from services.resume_screener import screen_resume
from services.db import get_pool

router = APIRouter(tags=["resume"])


class ScreenRequest(BaseModel):
    candidate_id: str = ""
    resume_id: str
    file_path: str
    job_title: str = ""


@router.post("/screen-resume")
async def screen_resume_endpoint(req: ScreenRequest):
    pool = await get_pool()
    print(f"[screen-resume] START resume_id={req.resume_id} file_path={req.file_path}")

    await pool.execute(
        "UPDATE resumes SET screening_status = 'processing' WHERE id = $1",
        req.resume_id,
    )

    try:
        file_path = req.file_path
        # If it's a URL, download it to a temp file
        if file_path.startswith("http://") or file_path.startswith("https://"):
            import tempfile, httpx
            print(f"[screen-resume] downloading from URL: {file_path}")
            # Retry up to 3 times — backend may be waking up on free tier (50s+ spin-up)
            last_err = None
            for attempt in range(3):
                try:
                    async with httpx.AsyncClient(timeout=90) as client:
                        r = await client.get(file_path)
                        r.raise_for_status()
                        content = r.content
                    break
                except Exception as e:
                    last_err = e
                    print(f"[screen-resume] download attempt {attempt+1} failed: {e}")
                    import asyncio
                    await asyncio.sleep(10)
            else:
                raise RuntimeError(f"Failed to download resume after 3 attempts: {last_err}")
            print(f"[screen-resume] downloaded {len(content)} bytes")
            suffix = ".pdf" if b"%PDF" in content[:10] else ".docx"
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            tmp.write(content)
            tmp.close()
            file_path = tmp.name
        elif not os.path.isabs(file_path):
            file_path = os.path.join(os.getenv("UPLOAD_DIR", "../backend/uploads"), file_path)

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Resume file not found: {file_path}")

        resume_text = await extract_text(file_path)
        print(f"[screen-resume] extracted {len(resume_text)} chars of text")
        if not resume_text.strip():
            raise ValueError("Could not extract text from resume — file may be scanned/image-based")

        # Fetch job role details + screening_params from DB
        job_title        = req.job_title
        job_description  = ""
        screening_params = {}

        row = await pool.fetchrow(
            """SELECT jr.title, jr.original_jd_text,
                      jr.key_points, jr.screening_params, jr.mandatory_skills,
                      c.id AS candidate_id,
                      c.current_ctc, c.expected_ctc, c.notice_period,
                      r.experience_years
               FROM resumes r
               JOIN candidates c ON c.id = r.candidate_id
               LEFT JOIN job_roles jr ON jr.id = c.job_role_id
               WHERE r.id = $1""",
            req.resume_id,
        )
        if row:
            if not job_title:
                job_title = row["title"] or ""
            job_description = row["original_jd_text"] or ""
            if row["screening_params"]:
                sp = row["screening_params"]
                screening_params = sp if isinstance(sp, dict) else json.loads(sp)

        candidate_details = {
            "current_ctc":      row["current_ctc"]      if row else None,
            "expected_ctc":     row["expected_ctc"]     if row else None,
            "notice_period":    row["notice_period"]    if row else None,
            "experience_years": row["experience_years"] if row else None,
        } if row else None

        # Parse key_points from DB
        key_points = []
        if row and row["key_points"]:
            kp = row["key_points"]
            key_points = kp if isinstance(kp, list) else json.loads(kp)

        # ── Hard filter: ALL mandatory_skills must be present ────────────────
        mandatory_skills = []
        if row and row["mandatory_skills"]:
            ms = row["mandatory_skills"]
            mandatory_skills = ms if isinstance(ms, list) else json.loads(ms)

        missing = [s for s in mandatory_skills if s.lower() not in resume_text.lower()]
        if missing:
            insight      = f"Con: Missing mandatory skill(s) — {', '.join(missing)}."
            candidate_id = row["candidate_id"] if row else None
            await pool.execute(
                "UPDATE resumes SET screening_status='completed', screened_at=NOW() WHERE id=$1",
                req.resume_id,
            )
            if candidate_id:
                await pool.execute(
                    "UPDATE candidates SET status='screen_reject', ai_decision_insight=$1 WHERE id=$2",
                    insight, candidate_id,
                )
            return {
                "status": "completed",
                "resume_id": req.resume_id,
                "candidate_status": "screen_reject",
                "hard_filter": True,
                "hard_filter_reason": f"Missing mandatory skills: {', '.join(missing)}",
                "ai_score": 0,
                "ai_summary": f"Auto-rejected: missing mandatory skill(s): {', '.join(missing)}.",
                "decision_insight": insight,
                "skills": [], "experience_years": 0,
                "strengths": [], "weaknesses": [],
                "ai_recommendation": "reject",
            }

        result = await screen_resume(
            resume_text,
            job_title=job_title,
            job_description=job_description,
            key_points=key_points,
            screening_params=screening_params,
            candidate_details=candidate_details,
        )

        await pool.execute(
            """UPDATE resumes
               SET parsed_text       = $1,
                   ai_summary        = $2,
                   ai_score          = $3,
                   skills            = $4,
                   experience_years  = $5,
                   screening_status  = 'completed',
                   screened_at       = NOW()
               WHERE id = $6""",
            resume_text[:10000],
            result["ai_summary"],
            result["ai_score"],
            json.dumps(result["skills"]),
            result["experience_years"],
            req.resume_id,
        )

        candidate_id = row["candidate_id"] if row else req.candidate_id or None

        # Determine new status — but only advance if candidate is already in 'screening'
        # (i.e. recruiter explicitly triggered the test). For 'uploaded' candidates who
        # just had their resume updated, keep them as 'uploaded'.
        cur_status_row = await pool.fetchrow(
            "SELECT status FROM candidates WHERE id = $1", candidate_id
        ) if candidate_id else None
        cur_status = cur_status_row["status"] if cur_status_row else None

        new_status = "screen_select" if result["ai_score"] >= 50 else "screen_reject"

        if not candidate_id:
            print(f"WARNING: No candidate_id for resume {req.resume_id} — skipping candidate update")
        elif cur_status in ("uploaded", "applied"):
            # Resume scored but screening not yet triggered — keep status as-is
            print(f"Candidate {candidate_id} is '{cur_status}', keeping status unchanged after resume score")
            new_status = cur_status
            await pool.execute(
                "UPDATE candidates SET ai_decision_insight = $1 WHERE id = $2",
                result.get("decision_insight") or None, candidate_id,
            )
        else:
            print(f"Updating candidate {candidate_id} → status={new_status}, score={result['ai_score']}")
            await pool.execute(
                "UPDATE candidates SET status = $1, ai_decision_insight = $2 WHERE id = $3",
                new_status, result.get("decision_insight") or None, candidate_id,
            )

        # Write extracted fields back to candidates
        if candidate_id:
            if result.get("linkedin_url"):
                await pool.execute(
                    "UPDATE candidates SET linkedin_url = $1 WHERE id = $2 AND (linkedin_url IS NULL OR linkedin_url = '')",
                    result["linkedin_url"], candidate_id,
                )
            if result.get("current_company"):
                await pool.execute(
                    "UPDATE candidates SET current_company = $1 WHERE id = $2 AND (current_company IS NULL OR current_company = '')",
                    result["current_company"], candidate_id,
                )
            if result.get("current_ctc") is not None:
                await pool.execute(
                    "UPDATE candidates SET current_ctc = $1 WHERE id = $2 AND current_ctc IS NULL",
                    result["current_ctc"], candidate_id,
                )
            if result.get("expected_ctc") is not None:
                await pool.execute(
                    "UPDATE candidates SET expected_ctc = $1 WHERE id = $2 AND expected_ctc IS NULL",
                    result["expected_ctc"], candidate_id,
                )

        if candidate_id and (result.get("strengths") or result.get("weaknesses") or result.get("ai_recommendation")):
            await pool.execute(
                """INSERT INTO evaluation_scores
                     (candidate_id, resume_score, strengths, weaknesses,
                      ai_feedback, ai_recommendation, question_scores)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (candidate_id) DO UPDATE SET
                     resume_score      = EXCLUDED.resume_score,
                     strengths         = EXCLUDED.strengths,
                     weaknesses        = EXCLUDED.weaknesses,
                     ai_feedback       = EXCLUDED.ai_feedback,
                     ai_recommendation = EXCLUDED.ai_recommendation,
                     question_scores   = EXCLUDED.question_scores""",
                candidate_id,
                result["ai_score"],
                json.dumps(result.get("strengths", [])),
                json.dumps(result.get("weaknesses", [])),
                result["ai_summary"],
                result.get("ai_recommendation", "hold"),
                json.dumps(result.get("question_scores", [])),
            )

        return {
            "status": "completed",
            "resume_id": req.resume_id,
            "candidate_status": new_status,
            **result,
        }

    except Exception as e:
        print(f"[screen-resume] FAILED resume_id={req.resume_id} error={e}")
        await pool.execute(
            "UPDATE resumes SET screening_status = 'failed' WHERE id = $1",
            req.resume_id,
        )
        raise HTTPException(status_code=500, detail=str(e))
