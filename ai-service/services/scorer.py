"""
Score weights:
  resume_score          30%
  technical_score       35%
  communication_score   20%
  confidence_score      15%
"""

WEIGHTS = {
    "resume_score":        0.30,
    "technical_score":     0.35,
    "communication_score": 0.20,
    "confidence_score":    0.15,
}

RECOMMENDATION_THRESHOLDS = {
    "hire":   75,
    "hold":   50,
}


def compute_overall_score(
    resume_score: float,
    technical_score: float,
    communication_score: float,
    confidence_score: float,
) -> float:
    raw = (
        resume_score        * WEIGHTS["resume_score"] +
        technical_score     * WEIGHTS["technical_score"] +
        communication_score * WEIGHTS["communication_score"] +
        confidence_score    * WEIGHTS["confidence_score"]
    )
    return round(raw, 2)


def derive_recommendation(overall_score: float) -> str:
    if overall_score >= RECOMMENDATION_THRESHOLDS["hire"]:
        return "hire"
    if overall_score >= RECOMMENDATION_THRESHOLDS["hold"]:
        return "hold"
    return "reject"


def aggregate_interview_scores(responses: list[dict]) -> dict:
    """
    Average per-dimension scores across all interview responses.
    Each response dict must have: technical_score, communication_score, confidence_score
    """
    if not responses:
        return {"technical_score": 0.0, "communication_score": 0.0, "confidence_score": 0.0}

    keys = ["technical_score", "communication_score", "confidence_score"]
    totals = {k: 0.0 for k in keys}

    for r in responses:
        for k in keys:
            totals[k] += float(r.get(k) or 0)

    count = len(responses)
    return {k: round(totals[k] / count, 2) for k in keys}
