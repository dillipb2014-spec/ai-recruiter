import json
import re
from services.litellm_client import litellm_generate, _sanitize, _extract_json
ollama_generate = litellm_generate


def _extract_linkedin(text: str) -> str:
    m = re.search(r'https?://(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+', text)
    if m:
        url = m.group()
        return url if url.startswith("https://") else url.replace("http://", "https://")
    m = re.search(r'linkedin\.com/in/([a-zA-Z0-9_-]+)', text)
    return f"https://www.linkedin.com/in/{m.group(1)}" if m else ""


def _extract_company(text: str) -> str:
    """Regex fallback: look for common patterns like 'at Company' or 'Company | Role'."""
    m = re.search(
        r'(?:currently\s+(?:at|working\s+at|employed\s+at)|present\s*[-–]\s*)([A-Z][\w\s&.,]+)',
        text, re.IGNORECASE
    )
    if m:
        return m.group(1).strip()[:80]
    # Look for lines with date range ending in Present
    m = re.search(r'^([A-Z][\w\s&.,]{2,40})\s*[|\-–].*(?:Present|Current)', text, re.MULTILINE | re.IGNORECASE)
    if m:
        return m.group(1).strip()[:80]
    return ""


def _keyword_score(text: str, keywords: list) -> float:
    if not keywords:
        return 50.0
    text_lower = text.lower()
    hits = sum(1 for kw in keywords if kw.lower() in text_lower)
    return round((hits / len(keywords)) * 100, 1)


def _exp_score(experience_years: float, ideal_min: float, ideal_max: float) -> float:
    if ideal_min <= experience_years <= ideal_max:
        return 100.0
    if experience_years < ideal_min:
        return max(0.0, round((experience_years / ideal_min) * 80, 1))
    return max(60.0, round(100 - (experience_years - ideal_max) * 5, 1))


async def screen_resume(
    resume_text: str,
    job_title: str = "",
    job_description: str = "",
    key_points: list[str] = None,
    screening_params: dict = None,
    candidate_details: dict = None,
) -> dict:
    text      = _sanitize(resume_text)
    job_title = _sanitize(job_title, 200)
    jd_text   = _sanitize(job_description, 3000)

    params        = screening_params or {}
    keywords      = params.get("keywords", [])
    design_kws    = params.get("design_keywords", [])
    ideal_min     = float(params.get("ideal_exp_min", 0))
    ideal_max     = float(params.get("ideal_exp_max", 99))
    kw_weight     = float(params.get("keyword_weight",  0.25))
    design_weight = float(params.get("design_weight",   0.10))
    exp_weight    = float(params.get("exp_weight",      0.15))
    kp_weight     = float(params.get("key_points_weight", 0.20))
    ai_weight     = float(params.get("ai_weight",       0.30))

    total_w = kw_weight + design_weight + exp_weight + kp_weight + ai_weight
    kw_weight     /= total_w
    design_weight /= total_w
    exp_weight    /= total_w
    kp_weight     /= total_w
    ai_weight     /= total_w

    # Build validated-fields block from DB so LLM won't flag known values as missing
    validated_lines = []
    if candidate_details:
        if candidate_details.get("current_ctc") not in (None, "", 0):
            validated_lines.append(f"- currentCTC = {candidate_details['current_ctc']} LPA (confirmed, do NOT flag as missing)")
        if candidate_details.get("expected_ctc") not in (None, "", 0):
            validated_lines.append(f"- expectedCTC = {candidate_details['expected_ctc']} LPA (confirmed, do NOT flag as missing)")
        if candidate_details.get("notice_period"):
            validated_lines.append(f"- noticePeriod = {candidate_details['notice_period']} (confirmed)")
        if candidate_details.get("experience_years") not in (None, ""):
            validated_lines.append(f"- yearsExperience = {candidate_details['experience_years']} years (confirmed)")
    validated_block = (
        "\n\nVALIDATED CANDIDATE FIELDS (already confirmed in our system — do NOT list these as weaknesses or areas to improve):\n"
        + "\n".join(validated_lines)
        + "\nCRITICAL: If expectedCTC or currentCTC is listed above, salary expectations are NOT unclear and must NOT appear in weaknesses.\n"
    ) if validated_lines else ""

    # Build screening questions block
    questions_block = ""
    if key_points:
        questions_block = "\n\nSCREENING QUESTIONS (evaluate candidate against each, score 0-10):\n" + \
            "\n".join(f"{i+1}. {q}" for i, q in enumerate(key_points))

    prompt = f"""You are a specialized Data Extraction Engine. Your goal is to parse the provided Resume text and return a valid JSON object.

Fields to Extract:
- current_company: The name of the candidate's most recent employer.
- total_experience: A single number representing total years of professional experience (round to 1 decimal). If not found, use 0.
- current_ctc: The candidate's current salary/CTC in LPA (Lakhs Per Annum) as a number. If not mentioned, use null.
- expected_ctc: The candidate's expected salary/CTC in LPA as a number. If not mentioned, use null.
- skillset_valuation: A list of the top 5 Hard Skills found that match modern engineering standards (e.g., React, TypeScript, Go).
- suitability_score: A percentage (0-100) based on how well these skills and experience match the Job Description. Score >= 50 means screen_select, < 50 means screen_reject. Score >= 75 means hire.
- ai_summary: If score < 50 start with 'Rejected:' and state specific missing skills/gaps. If score >= 50 describe fit positively.
- strengths: List of 2-3 specific strengths relative to the JD.
- weaknesses: List of 1-2 specific gaps or missing requirements.
- ai_recommendation: 'hire' if score >= 75, 'hold' if 50-74, 'reject' if score < 50.
- linkedin_url: Full LinkedIn profile URL found in the resume, or empty string.
- decision_insight: Exactly 1 sentence. Start with 'Pro:' if score >= 50 highlighting their strongest technical asset. Start with 'Con:' if score < 50 stating the primary mismatch (Tech Stack, Experience, or Relocation).
- question_scores: For EACH screening question listed below, return an object with: index (1-based int), question (exact question text), score (float 0-10 based on how well the resume addresses it), answer (1-2 sentences summarising evidence from the resume). Return [] only if there are no screening questions.

Constraint: Return ONLY the JSON object. Do not include any introductory text or explanations.

### JOB DESCRIPTION (The Standard):
{jd_text or "Not provided."}{questions_block}
{validated_block}
### RESUME TEXT (The Candidate):
{text}

### TASK:
Extract current_company, total_experience, current_ctc, expected_ctc and evaluate the skillset against the JD above.
Provide the suitability_score and decision_insight.
For question_scores, score EVERY screening question listed above — do not skip any.
Output JSON only.

{{
  "current_company": "<most recent employer>",
  "total_experience": 0,
  "current_ctc": null,
  "expected_ctc": null,
  "skillset_valuation": ["skill1", "skill2", "skill3"],
  "suitability_score": 75,
  "ai_summary": "<fit summary>",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["gap1"],
  "ai_recommendation": "hire",
  "linkedin_url": "",
  "decision_insight": "Pro: ...",
  "question_scores": [
    {{"index": 1, "question": "<question text>", "score": 8.0, "answer": "<how resume addresses this>"}}
  ]
}}"""

    raw = await ollama_generate(prompt)

    try:
        data = json.loads(_extract_json(raw))
    except (json.JSONDecodeError, ValueError) as e:
        print(f"JSON parse error: {e} | Raw snippet: {raw[:300]}")
        data = {}

    # Map new field names with fallbacks to old names for compatibility
    ai_score         = max(0.0, min(100.0, float(data.get("suitability_score") or data.get("ai_score") or 50)))
    experience_years = float(data.get("total_experience") or data.get("experience_years") or 0)
    skills           = data.get("skillset_valuation") or data.get("skills") or []
    current_company  = str(data.get("current_company") or "").strip()
    _ctc = lambda v: round(float(v), 2) if v not in (None, "", "null") else None
    current_ctc      = _ctc(data.get("current_ctc"))
    expected_ctc     = _ctc(data.get("expected_ctc"))

    # Fallback: regex-extract current_company if LLM returned empty
    if not current_company:
        current_company = _extract_company(resume_text)

    # experience_years fallback: if still 0, flag it
    exp_not_found = experience_years == 0.0

    # Component scores
    kw_s     = _keyword_score(text, keywords)
    design_s = _keyword_score(text, design_kws)
    exp_s    = _exp_score(experience_years, ideal_min, ideal_max)
    kp_s     = _keyword_score(text, key_points or [])

    final_score = round(
        kw_s     * kw_weight +
        design_s * design_weight +
        exp_s    * exp_weight +
        kp_s     * kp_weight +
        ai_score * ai_weight,
        1
    )

    # Override: if experience could not be determined, note it in insight
    if exp_not_found:
        experience_years = 0.0

    exp_flag = (
        "Ideal"       if ideal_min <= experience_years <= ideal_max else
        "Junior"      if experience_years < ideal_min else
        "Experienced"
    )

    # LinkedIn: prefer LLM extraction, fall back to regex
    linkedin_url = str(data.get("linkedin_url") or "").strip()
    if not linkedin_url or "linkedin.com/in/" not in linkedin_url:
        linkedin_url = _extract_linkedin(resume_text)

    raw_insight = str(data.get("decision_insight") or "").strip()
    if final_score >= 50 and not raw_insight.startswith("Pro:"):
        raw_insight = ""
    if final_score < 50 and not raw_insight.startswith("Con:"):
        raw_insight = ""
    if exp_not_found and not raw_insight:
        raw_insight = "Con: Experience not specified — total years of professional experience could not be determined from the resume."

    return {
        "ai_summary":        str(data.get("ai_summary", "")),
        "ai_score":          final_score,
        "skills":            skills,
        "experience_years":  experience_years,
        "current_company":   current_company,
        "current_ctc":       current_ctc,
        "expected_ctc":      expected_ctc,
        "strengths":         data.get("strengths", []),
        "weaknesses":        data.get("weaknesses", []),
        "ai_recommendation": data.get("ai_recommendation", "hold"),
        "linkedin_url":      linkedin_url,
        "decision_insight":  raw_insight,
        "exp_flag":          exp_flag,
        "question_scores":   data.get("question_scores", []),
        "score_breakdown": {
            "keyword":    kw_s,
            "design":     design_s,
            "exp":        exp_s,
            "key_points": kp_s,
            "ai_raw":     ai_score,
        },
    }
