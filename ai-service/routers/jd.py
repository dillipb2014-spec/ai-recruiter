import json
import os
import re
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from services.litellm_client import litellm_generate, _sanitize
ollama_generate = litellm_generate
from services.pdf_extractor import extract_text

router = APIRouter(tags=["jd"])


@router.post("/parse-jd")
async def parse_jd(
    jd_text: str = Form(default=""),
    file: UploadFile = File(default=None),
):
    text = ""

    # Accept either raw text or a PDF/DOCX upload
    if file and file.filename:
        tmp_path = f"/tmp/jd_{file.filename}"
        with open(tmp_path, "wb") as f:
            f.write(await file.read())
        try:
            text = await extract_text(tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    if not text:
        text = jd_text

    text = _sanitize(text, 4000)
    if not text.strip():
        raise HTTPException(status_code=400, detail="No JD text provided")

    prompt = f"""You are a senior technical recruiter at Juspay.
Analyse this Job Description and extract structured information.

JOB DESCRIPTION:
{text}

Respond with ONLY this JSON (no markdown, no explanation):
{{
  "key_points": ["<top responsibility or quality 1>", "<2>", "<3>", "<4>", "<5>"],
  "suggested_mandatory_skill": "<single most critical technical skill, e.g. React>"
}}

Rules:
- key_points must be exactly 5 short phrases (max 8 words each)
- suggested_mandatory_skill must be ONE word or short phrase (e.g. "React", "Python", "Figma")
"""

    try:
        raw = await ollama_generate(prompt)
        # Strip markdown fences if model adds them
        raw = re.sub(r"```(?:json)?|```", "", raw).strip()
        data = json.loads(raw)
    except Exception:
        m = re.search(r'\{.*\}', raw if 'raw' in dir() else '{}', re.DOTALL)
        try:
            data = json.loads(m.group()) if m else {}
        except Exception:
            data = {}

    key_points = data.get("key_points", [])[:5]
    mandatory_skill = str(data.get("suggested_mandatory_skill", "")).strip()

    return {
        "key_points": key_points,
        "suggested_mandatory_skill": mandatory_skill,
    }
