const router  = require("express").Router();
const csurf   = require("csurf");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const db      = require("../db");
const { requireAuth } = require("./admin");
const { createInterview, getQuestions, getCandidateInterview } = require("../controllers/interviewController");

const csrf = csurf({ cookie: { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", secure: process.env.NODE_ENV === "production" } });

const UPLOAD_DIR   = path.resolve(process.env.UPLOAD_DIR || "uploads");
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";
const AI_BASE      = process.env.AI_SERVICE_URL || "http://localhost:8000";

const videoUpload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) return cb(null, true);
    cb(new Error("Only video files allowed"));
  },
});

// Protected: recruiter creates interview
router.post("/", requireAuth, csrf, createInterview);

// Protected: recruiter views candidate interview
router.get("/candidate/:candidateId", requireAuth, getCandidateInterview);

// Public: candidate-facing (they access via their interview link)
router.get("/:interviewId/questions", getQuestions);

router.post("/:interviewId/responses", csrf, videoUpload.single("video"), async (req, res) => {
  const { interviewId } = req.params;
  const questionIndex   = parseInt(req.body.question_index, 10);

  if (!req.file) return res.status(400).json({ error: "No video file uploaded" });
  if (isNaN(questionIndex)) return res.status(400).json({ error: "question_index required" });

  const resolvedPath = path.resolve(req.file.path);
  if (!resolvedPath.startsWith(UPLOAD_DIR)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Invalid file path" });
  }

  const qRow = await db.query(
    `SELECT question_text FROM interview_questions WHERE interview_id = $1 AND question_index = $2`,
    [interviewId, questionIndex]
  );
  if (!qRow.rows.length) return res.status(404).json({ error: "Question not found" });

  const rRow = await db.query(
    `INSERT INTO interview_responses (interview_id, question_index, question_text, video_path, transcript_status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
    [interviewId, questionIndex, qRow.rows[0].question_text, resolvedPath]
  );
  const responseId = rRow.rows[0].id;

  fetch(`${AI_BASE}/interview/process-response`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
    body: JSON.stringify({ response_id: responseId, interview_id: interviewId, video_path: resolvedPath, question_index: questionIndex }),
  }).catch((err) => console.error("AI process-response failed:", err.message));

  res.status(201).json({ response_id: responseId, status: "processing" });
});

router.post("/:interviewId/complete", csrf, async (req, res) => {
  const { interviewId } = req.params;
  const iRow = await db.query("SELECT candidate_id FROM interviews WHERE id = $1", [interviewId]);
  if (!iRow.rows.length) return res.status(404).json({ error: "Interview not found" });

  await db.query("UPDATE interviews SET status = 'completed', completed_at = NOW() WHERE id = $1", [interviewId]);

  fetch(`${AI_BASE}/scorecard/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
    body: JSON.stringify({ candidate_id: iRow.rows[0].candidate_id, interview_id: interviewId }),
  }).catch((err) => console.error("Scorecard generation failed:", err.message));

  res.json({ status: "completed", candidate_id: iRow.rows[0].candidate_id, interview_id: interviewId });
});

// Public: candidate polls their own status
router.get("/:interviewId/status", async (req, res) => {
  const rows = await db.query(
    `SELECT question_index, transcript_status, transcript
     FROM interview_responses WHERE interview_id = $1 ORDER BY question_index`,
    [req.params.interviewId]
  );
  res.json({ responses: rows.rows });
});

module.exports = router;
