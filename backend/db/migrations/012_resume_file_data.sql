-- Store resume binary in DB so files survive Render redeploys
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_data BYTEA;
