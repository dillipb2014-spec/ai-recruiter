import html
import re

SYSTEM_PROMPT = """You are an expert technical interviewer and talent evaluator.
Evaluate the candidate's answer strictly based on the criteria given.
Always respond with valid JSON only — no markdown, no explanation outside the JSON."""


def _sanitize(text: str, max_len: int = 2000) -> str:
    text = html.escape(str(text).strip())
    # Strip prompt injection attempts
    text = re.sub(r"(ignore|disregard|forget).{0,30}(above|previous|instructions)", "", text, flags=re.I)
    return text[:max_len]


def build_evaluation_prompt(question: str, transcript: str, job_role: str) -> str:
    question   = _sanitize(question, 500)
    transcript = _sanitize(transcript, 2000)
    job_role   = _sanitize(job_role, 100)
    return f"""Evaluate this interview answer for a {job_role} position.

QUESTION: {question}

CANDIDATE ANSWER: {transcript}

Score each dimension from 0 to 100 and provide brief reasoning.

Respond with this exact JSON structure:
{{
  "relevance": {{
    "score": <0-100>,
    "reasoning": "<one sentence>"
  }},
  "technical_knowledge": {{
    "score": <0-100>,
    "reasoning": "<one sentence>"
  }},
  "communication_clarity": {{
    "score": <0-100>,
    "reasoning": "<one sentence>"
  }},
  "strengths": ["<point>", "<point>"],
  "weaknesses": ["<point>", "<point>"],
  "overall_feedback": "<two to three sentences summarising the answer>"
}}"""


def build_final_scorecard_prompt(job_role: str, evaluations: list[dict], candidate_details: dict = None) -> str:
    job_role = _sanitize(job_role, 100)
    answers_block = "\n\n".join(
        f"Q{i+1}: {e['question']}\nScores — relevance: {e['relevance']}, "
        f"technical: {e['technical_knowledge']}, clarity: {e['communication_clarity']}"
        for i, e in enumerate(evaluations)
    )

    # Build a validated-fields block so the AI doesn't hallucinate missing data
    validated_fields = []
    if candidate_details:
        if candidate_details.get("current_ctc") not in (None, "", 0):
            validated_fields.append(f"currentCTC = {candidate_details['current_ctc']} LPA (confirmed, do NOT flag as missing)")
        if candidate_details.get("expected_ctc") not in (None, "", 0):
            validated_fields.append(f"expectedCTC = {candidate_details['expected_ctc']} LPA (confirmed, do NOT flag as missing)")
        if candidate_details.get("notice_period"):
            validated_fields.append(f"noticePeriod = {candidate_details['notice_period']} (confirmed)")
        if candidate_details.get("experience_years") not in (None, ""):
            validated_fields.append(f"yearsExperience = {candidate_details['experience_years']} years (confirmed)")

    validation_block = ""
    if validated_fields:
        validation_block = f"""

VALIDATED CANDIDATE FIELDS (already confirmed — do NOT list these as weaknesses or areas to improve):
{chr(10).join(f'- {f}' for f in validated_fields)}
"""

    return f"""You are summarising a full interview for a {job_role} candidate.

INDIVIDUAL ANSWER SCORES:
{answers_block}{validation_block}
CRITICAL RULE: If a field is listed above as "provided", you MUST NOT mention it as unclear, missing, or an area to improve. Compensation expectations are NOT a weakness if current_ctc or expected_ctc is provided.

Provide a final hiring recommendation as JSON:
{{
  "overall_score": <0-100 weighted average>,
  "ai_recommendation": "<hire | hold | reject>",
  "strengths": ["<point>", "<point>", "<point>"],
  "weaknesses": ["<point>", "<point>"],
  "ai_feedback": "<three to four sentence overall assessment>"
}}"""
