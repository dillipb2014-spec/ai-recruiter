const db = require("../db");

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";
const AI_BASE      = process.env.AI_SERVICE_URL || "http://localhost:8000";

// POST /api/interviews  — create interview + generate questions via AI
async function createInterview(req, res) {
  const { candidate_id } = req.body;
  if (!candidate_id) return res.status(400).json({ error: "candidate_id is required" });

  const cRow = await db.query(
    `SELECT c.id, c.full_name, jr.title, jr.description, jr.requirements
     FROM candidates c
     LEFT JOIN job_roles jr ON jr.id = c.job_role_id
     WHERE c.id = $1`,
    [candidate_id]
  );
  if (!cRow.rows.length) return res.status(404).json({ error: "Candidate not found" });

  const candidate = cRow.rows[0];
  const jobRole   = candidate.title || "General";

  // Create interview record
  const iRow = await db.query(
    `INSERT INTO interviews (candidate_id, job_role, job_description, status)
     VALUES ($1, $2, $3, 'scheduled') RETURNING id`,
    [candidate_id, jobRole, candidate.description || ""]
  );
  const interviewId = iRow.rows[0].id;

  // Ask AI service to generate questions
  let questions = [];
  try {
    const aiRes = await fetch(`${AI_BASE}/interview/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
      body: JSON.stringify({
        interview_id:     interviewId,
        job_role:         jobRole,
        job_description:  candidate.description  || "",
        job_requirements: candidate.requirements || "",
      }),
    });
    if (!aiRes.ok) throw new Error(`AI service: ${aiRes.status}`);
    const data = await aiRes.json();
    questions = data.questions || [];
  } catch (err) {
    console.error("Question generation failed:", err.message);
    // Fallback generic questions
    questions = [
      "Tell me about yourself and your background.",
      "What are your key technical strengths relevant to this role?",
      "Describe a challenging project you worked on and how you handled it.",
      "How do you approach problem-solving under pressure?",
      "Where do you see yourself in the next 3 years?",
    ];
  }

  // Persist questions
  for (let i = 0; i < questions.length; i++) {
    await db.query(
      `INSERT INTO interview_questions (interview_id, question_index, question_text)
       VALUES ($1, $2, $3)`,
      [interviewId, i, questions[i]]
    );
  }

  // Update candidate status
  await db.query("UPDATE candidates SET status = 'interview' WHERE id = $1", [candidate_id]);

  res.status(201).json({ interview_id: interviewId, questions });
}

// GET /api/interviews/:interviewId/questions
async function getQuestions(req, res) {
  const rows = await db.query(
    `SELECT question_index, question_text FROM interview_questions
     WHERE interview_id = $1 ORDER BY question_index`,
    [req.params.interviewId]
  );
  if (!rows.rows.length) return res.status(404).json({ error: "Interview not found" });
  res.json({ questions: rows.rows.map((r) => r.question_text) });
}

// GET /api/interviews/candidate/:candidateId
async function getCandidateInterview(req, res) {
  const row = await db.query(
    `SELECT i.id, i.status, i.job_role, i.created_at
     FROM interviews i
     WHERE i.candidate_id = $1
     ORDER BY i.created_at DESC LIMIT 1`,
    [req.params.candidateId]
  );
  if (!row.rows.length) return res.status(404).json({ error: "No interview found" });
  res.json(row.rows[0]);
}

module.exports = { createInterview, getQuestions, getCandidateInterview };
