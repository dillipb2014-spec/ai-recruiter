-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- RECRUITERS
-- ─────────────────────────────────────────
CREATE TABLE recruiters (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'recruiter',  -- recruiter | admin
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- CANDIDATES
-- ─────────────────────────────────────────
CREATE TABLE candidates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name    VARCHAR(255) NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  phone        VARCHAR(30),
  linkedin_url TEXT,
  status       VARCHAR(50) NOT NULL DEFAULT 'applied',
  -- applied | screening | interview | evaluated | hired | rejected
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- RESUMES
-- ─────────────────────────────────────────
CREATE TABLE resumes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id        UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  file_path           TEXT NOT NULL,
  file_name           TEXT NOT NULL,
  mime_type           VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  parsed_text         TEXT,                    -- raw extracted text
  ai_summary          TEXT,                    -- LLM-generated summary
  ai_score            NUMERIC(5,2),            -- 0.00 – 100.00
  skills              JSONB NOT NULL DEFAULT '[]',   -- ["Python","AWS",...]
  experience_years    NUMERIC(4,1),
  screening_status    VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending | processing | completed | failed
  screened_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INTERVIEWS
-- ─────────────────────────────────────────
CREATE TABLE interviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  recruiter_id    UUID REFERENCES recruiters(id) ON DELETE SET NULL,
  job_role        VARCHAR(255) NOT NULL,
  job_description TEXT,
  status          VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  -- scheduled | in_progress | completed | cancelled
  scheduled_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INTERVIEW RESPONSES
-- ─────────────────────────────────────────
CREATE TABLE interview_responses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_id      UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  question_index    SMALLINT NOT NULL,
  question_text     TEXT NOT NULL,
  video_path        TEXT,                  -- stored video file path
  audio_path        TEXT,                  -- extracted audio path
  transcript        TEXT,                  -- speech-to-text output
  transcript_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending | processing | completed | failed
  duration_seconds  NUMERIC(6,1),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- EVALUATION SCORES
-- ─────────────────────────────────────────
CREATE TABLE evaluation_scores (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id          UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  interview_id          UUID REFERENCES interviews(id) ON DELETE SET NULL,
  resume_score          NUMERIC(5,2),          -- from resume screening
  communication_score   NUMERIC(5,2),          -- from speech analysis
  technical_score       NUMERIC(5,2),          -- from answer evaluation
  confidence_score      NUMERIC(5,2),          -- tone / sentiment
  overall_score         NUMERIC(5,2),          -- weighted final score
  strengths             JSONB NOT NULL DEFAULT '[]',
  weaknesses            JSONB NOT NULL DEFAULT '[]',
  ai_recommendation     VARCHAR(50),           -- hire | hold | reject
  ai_feedback           TEXT,                  -- detailed LLM feedback
  evaluated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
CREATE INDEX idx_resumes_candidate        ON resumes(candidate_id);
CREATE INDEX idx_resumes_screening_status ON resumes(screening_status);
CREATE INDEX idx_interviews_candidate     ON interviews(candidate_id);
CREATE INDEX idx_interviews_status        ON interviews(status);
CREATE INDEX idx_responses_interview      ON interview_responses(interview_id);
CREATE INDEX idx_scores_candidate         ON evaluation_scores(candidate_id);
CREATE INDEX idx_candidates_status        ON candidates(status);

-- ─────────────────────────────────────────
-- AUTO-UPDATE updated_at ON candidates
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
