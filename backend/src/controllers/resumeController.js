const db   = require("../db");
const fs   = require("fs");
const path = require("path");

const UPLOAD_DIR   = path.resolve(process.env.UPLOAD_DIR || "uploads");
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";

const AI_SCREEN_URL = (() => {
  const base    = process.env.AI_SERVICE_URL || "http://localhost:8000";
  const allowed = (process.env.AI_SERVICE_ALLOWED_HOST || "localhost:8000").split(",");
  const { host } = new URL(base);
  if (!allowed.includes(host)) throw new Error(`Untrusted AI service host: ${host}`);
  return new URL("/screen-resume", base).toString();
})();

async function triggerAIScreening(resumeId, filePath, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(AI_SCREEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
        body: JSON.stringify({ resume_id: resumeId, file_path: filePath }),
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

  const resolvedPath = path.resolve(req.file.path);
  if (!resolvedPath.startsWith(UPLOAD_DIR)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Invalid file path" });
  }

  const candidate = await db.query("SELECT id, status FROM candidates WHERE id = $1", [candidateId]);
  if (!candidate.rows.length) {
    fs.unlinkSync(resolvedPath);
    return res.status(404).json({ error: "Candidate not found" });
  }

  const result = await db.query(
    `INSERT INTO resumes (candidate_id, file_path, file_name, mime_type)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [candidateId, resolvedPath, req.file.originalname, req.file.mimetype]
  );

  const cStatus = candidate.rows[0]?.status;

  // 'applied' (apply-page) and 'uploaded' (bulk) — just score resume, keep status
  // so the candidate waits for recruiter to send screening test.
  // Any other status means recruiter re-uploaded — reset and re-evaluate.
  if (cStatus === "uploaded" || cStatus === "applied") {
    triggerAIScreening(result.rows[0].id, resolvedPath).catch((err) =>
      console.error("AI screening trigger failed:", err.message)
    );
  } else {
    await db.query(
      "UPDATE candidates SET status = 'PENDING', ai_decision_insight = NULL WHERE id = $1",
      [candidateId]
    );
    triggerAIScreening(result.rows[0].id, resolvedPath).catch((err) =>
      console.error("AI screening trigger failed:", err.message)
    );
  }

  res.status(201).json({ message: "Resume uploaded successfully", resume: result.rows[0] });
}

async function uploadResumeForRole(req, res) {
  const { roleId } = req.params;
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const resolvedPath = path.resolve(req.file.path);
  if (!resolvedPath.startsWith(UPLOAD_DIR)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Invalid file path" });
  }

  const role = await db.query("SELECT id FROM job_roles WHERE id = $1", [roleId]);
  if (!role.rows.length) {
    fs.unlinkSync(resolvedPath);
    return res.status(404).json({ error: "Job role not found" });
  }

  const candidateName  = (req.body.full_name || "").trim() || "Unknown Candidate";
  const candidateEmail = (req.body.email || "").trim() ||
    `upload_${Date.now()}_${Math.random().toString(36).slice(2)}@noemail.local`;

  const candidateResult = await db.query(
    `INSERT INTO candidates (full_name, email, job_role_id, status)
     VALUES ($1, $2, $3, 'screening') RETURNING id`,
    [candidateName, candidateEmail, roleId]
  );

  const resumeResult = await db.query(
    `INSERT INTO resumes (candidate_id, file_path, file_name, mime_type)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [candidateResult.rows[0].id, resolvedPath, req.file.originalname, req.file.mimetype]
  );

  triggerAIScreening(resumeResult.rows[0].id, resolvedPath).catch((err) =>
    console.error("AI screening trigger failed:", err.message)
  );

  res.status(201).json({
    message: "Resume uploaded and screening started",
    resume: resumeResult.rows[0],
    candidateId: candidateResult.rows[0].id,
  });
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

module.exports = { uploadResume, getResume, uploadResumeForRole };
