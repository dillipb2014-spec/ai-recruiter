-- 009: mandatory_skill → mandatory_skills (JSONB array)
ALTER TABLE job_roles
  ADD COLUMN IF NOT EXISTS mandatory_skills JSONB DEFAULT '[]'::jsonb;

-- Migrate existing single skill to array
UPDATE job_roles
  SET mandatory_skills = to_jsonb(ARRAY[mandatory_skill])
  WHERE mandatory_skill IS NOT NULL AND mandatory_skill != '';

ALTER TABLE job_roles
  DROP COLUMN IF EXISTS mandatory_skill;
