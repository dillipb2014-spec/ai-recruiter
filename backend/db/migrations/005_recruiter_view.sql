-- Fast read view used by the recruiter dashboard
-- Combines candidate, resume, and evaluation data into one virtual table
CREATE OR REPLACE VIEW recruiter_console_view AS
SELECT
    c.id,
    c.full_name,
    c.email,
    c.phone,
    c.status,
    c.created_at,
    c.job_role_id,
    jr.title                                          AS job_role_title,
    r.id                                              AS resume_id,
    r.ai_score                                        AS resume_score,
    r.skills,
    r.experience_years,
    r.screening_status,
    es.overall_score,
    es.technical_score,
    es.communication_score,
    es.confidence_score,
    es.ai_recommendation,
    es.strengths,
    es.weaknesses,
    es.ai_feedback,
    -- Source flag: bulk uploads use @noemail.local placeholder emails
    CASE WHEN c.email LIKE '%@noemail.local' THEN 'bulk' ELSE 'individual' END AS source
FROM candidates c
LEFT JOIN job_roles jr          ON jr.id = c.job_role_id
LEFT JOIN resumes r             ON r.candidate_id = c.id
LEFT JOIN evaluation_scores es  ON es.candidate_id = c.id;

-- Index to speed up score-range queries on the base tables
CREATE INDEX IF NOT EXISTS idx_resumes_ai_score       ON resumes(ai_score);
CREATE INDEX IF NOT EXISTS idx_eval_overall_score     ON evaluation_scores(overall_score);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at  ON candidates(created_at);
