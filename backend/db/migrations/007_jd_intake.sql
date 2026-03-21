-- 007: Smart JD Intake fields
ALTER TABLE job_roles
  ADD COLUMN IF NOT EXISTS key_points      JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mandatory_skill TEXT;
