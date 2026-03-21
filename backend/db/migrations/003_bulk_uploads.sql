-- Bulk upload tracking table
CREATE TABLE IF NOT EXISTS bulk_uploads (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_role_id  UUID REFERENCES job_roles(id) ON DELETE SET NULL,
  file_name    TEXT NOT NULL,
  total_rows   INT NOT NULL DEFAULT 0,
  processed    INT NOT NULL DEFAULT 0,
  failed       INT NOT NULL DEFAULT 0,
  status       VARCHAR(50) NOT NULL DEFAULT 'processing', -- processing | completed | failed
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulk_uploads_role ON bulk_uploads(job_role_id);
