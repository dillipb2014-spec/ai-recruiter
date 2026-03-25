const db   = require("../db");

const INTERNAL_KEY  = process.env.INTERNAL_API_KEY || "";
const BACKEND_URL   = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;
const AI_SCREEN_URL = new URL("/screen-resume", process.env.AI_SERVICE_URL || "http://localhost:8000").toString();

async function triggerAIScreening(resumeId, retries = 3) {
  const publicUrl = `${BACKEND_URL}/api/resumes/file/${resumeId}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(AI_SCREEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
        body: JSON.stringify({ resume_id: resumeId, file_path: publicUrl }),
      });
      if (!response.ok) throw new Error(`AI service responded with ${response.status}`);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

async function uploadResume(req, res) {
  const { candidateId } = req.params;
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const candidate = await db.query("SELECT id, status FROM candidates WHERE id = $1", [candidateId]);
  if (!candidate.rows.length) return res.status(404).json({ error: "Candidate not found" });

  const result = await db.query(
    `INSERT INTO resumes (candidate_id, file_path, file_name, mime_type, file_data)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, file_name, mime_type, screening_status, created_at`,
    [candidateId, req.file.originalname, req.file.originalname, req.file.mimetype, req.file.buffer]
  );

  const cStatus = candidate.rows[0]?.status;
  if (cStatus !== "uploaded" && cStatus !== "applied") {
    await db.query(
      "UPDATE candidates SET status = 'PENDING', ai_decision_insight = NULL WHERE id = $1",
      [candidateId]
    );
  }

  triggerAIScreening(result.rows[0].id).catch((err) =>
    console.error("AI screening trigger failed:", err.message)
  );

  res.status(201).json({ message: "Resume uploaded successfully", resume: result.rows[0] });
}

async function uploadResumeForRole(req, res) {
  const { roleId } = req.params;
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const role = await db.query("SELECT id FROM job_roles WHERE id = $1", [roleId]);
  if (!role.rows.length) return res.status(404).json({ error: "Job role not found" });

  const candidateName  = (req.body.full_name || "").trim() || "Unknown Candidate";
  const candidateEmail = (req.body.email || "").trim() ||
    `upload_${Date.now()}_${Math.random().toString(36).slice(2)}@noemail.local`;

  const candidateResult = await db.query(
    `INSERT INTO candidates (full_name, email, job_role_id, status)
     VALUES ($1, $2, $3, 'screening') RETURNING id`,
    [candidateName, candidateEmail, roleId]
  );

  const resumeResult = await db.query(
    `INSERT INTO resumes (candidate_id, file_path, file_name, mime_type, file_data)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, file_name, mime_type, screening_status, created_at`,
    [candidateResult.rows[0].id, req.file.originalname, req.file.originalname, req.file.mimetype, req.file.buffer]
  );

  triggerAIScreening(resumeResult.rows[0].id).catch((err) =>
    console.error("AI screening trigger failed:", err.message)
  );

  res.status(201).json({
    message: "Resume uploaded and screening started",
    resume: resumeResult.rows[0],
    candidateId: candidateResult.rows[0].id,
  });
}

// Serve resume file from DB — used by both frontend viewer and AI service
async function serveResumeFile(req, res) {
  const { resumeId } = req.params;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(resumeId)) return res.status(400).end();

  const result = await db.query(
    "SELECT file_name, mime_type, file_data FROM resumes WHERE id = $1",
    [resumeId]
  );
  if (!result.rows.length || !result.rows[0].file_data) return res.status(404).end();

  const { file_name, mime_type, file_data } = result.rows[0];
  res.setHeader("Content-Type", mime_type || "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${file_name}"`);
  res.send(file_data);
}

async function getResume(req, res) {
  const result = await db.query(
    `SELECT id, file_name, mime_type, ai_summary, ai_score, skills,
            experience_years, screening_status, screened_at, created_at
     FROM resumes WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [req.params.candidateId]
  );
  if (!result.rows.length) return res.status(404).json({ error: "No resume found" });
  res.json(result.rows[0]);
}

module.exports = { uploadResume, getResume, uploadResumeForRole, serveResumeFile };
