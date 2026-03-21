-- 008: Smart JD refactor — store original JD text, drop redundant fields
ALTER TABLE job_roles
  ADD COLUMN IF NOT EXISTS original_jd_text TEXT;

-- Migrate existing data before dropping
UPDATE job_roles
  SET original_jd_text = COALESCE(jd_text, description || E'\n' || COALESCE(requirements, ''))
  WHERE original_jd_text IS NULL;

ALTER TABLE job_roles
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS requirements,
  DROP COLUMN IF EXISTS jd_text;
