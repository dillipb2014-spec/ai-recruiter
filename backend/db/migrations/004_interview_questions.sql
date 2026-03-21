-- Add unique constraint to evaluation_scores so ON CONFLICT works
ALTER TABLE evaluation_scores
  ADD CONSTRAINT uq_eval_candidate_interview UNIQUE (candidate_id, interview_id);

-- Interview questions bank per job role
CREATE TABLE IF NOT EXISTS interview_questions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  question_index SMALLINT NOT NULL,
  question_text  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iq_interview ON interview_questions(interview_id);
