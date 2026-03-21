CREATE TABLE job_roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  requirements TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_roles_title ON job_roles(title);

-- Add job_role_id to candidates so we know which role they applied for
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS job_role_id UUID REFERENCES job_roles(id) ON DELETE SET NULL;
