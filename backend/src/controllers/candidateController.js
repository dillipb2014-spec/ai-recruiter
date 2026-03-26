const db = require("../db");
const { sendScreeningTestEmail } = require("../services/emailService");

async function registerCandidate(req, res) {
  const { full_name, email, phone, linkedin_url, job_role_id,
          current_company, current_ctc, expected_ctc, relocation_ready, notice_period } = req.body;

  if (!full_name || !email)
    return res.status(400).json({ error: "full_name and email are required" });
  if (!job_role_id)
    return res.status(400).json({ error: "job_role_id is required" });

  const role = await db.query("SELECT id, title FROM job_roles WHERE id = $1", [job_role_id]);
  if (!role.rows.length)
    return res.status(404).json({ error: "Selected job role not found" });

  const result = await db.query(
    `INSERT INTO candidates
       (full_name, email, phone, linkedin_url, job_role_id,
        current_company, current_ctc, expected_ctc, relocation_ready, notice_period)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, full_name, email, phone, status, created_at`,
    [full_name, email, phone || null, linkedin_url || null, job_role_id,
     current_company || null, current_ctc || null, expected_ctc || null,
     relocation_ready === true || relocation_ready === "true",
     notice_period || null]
  );

  const candidateId = result.rows[0].id;

  if (req.file) {
    await db.query(
      `INSERT INTO resumes (candidate_id, file_path, file_name, mime_type)
       VALUES ($1, $2, $3, $4)`,
      [candidateId, req.file.path, req.file.originalname, req.file.mimetype]
    );
  }

  sendScreeningTestEmail(result.rows[0], role.rows[0].title).catch((err) =>
    console.error("[EMAIL ERROR] Screening email failed for", result.rows[0].email, ":", err.message)
  );

  res.status(201).json({ message: "Candidate registered", candidate: result.rows[0] });
}

// ── List candidates — powered by recruiter_console_view ──────────────────────
async function listCandidates(req, res) {
  const {
    status, search,
    sort = "created_at", order = "desc",
    score_min, score_max,
    skills, proficiency, exp_bucket,
    source, timeline,
  } = req.query;

  const conditions = [];
  const values     = [];
  const push = (val) => { values.push(val); return `$${values.length}`; };

  // Multi-status (comma-separated)
  if (status) {
    const list = status.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length === 1) conditions.push(`status = ${push(list[0])}`);
    else                   conditions.push(`status = ANY(${push(list)})`);
  }

  if (search) {
    const like = `%${search}%`;
    conditions.push(`(full_name ILIKE ${push(like)} OR email ILIKE ${push(like)})`);
  }

  // Score range — prefer overall_score, fall back to resume_score
  if (score_min != null && score_min !== "")
    conditions.push(`COALESCE(overall_score, resume_score, 0) >= ${push(parseFloat(score_min))}`);
  if (score_max != null && score_max !== "")
    conditions.push(`COALESCE(overall_score, resume_score, 0) <= ${push(parseFloat(score_max))}`);

  // Skills — candidate must have ALL listed skills (JSONB containment)
  if (skills) {
    skills.split(",").map((s) => s.trim()).filter(Boolean)
      .forEach((sk) => conditions.push(`skills @> ${push(JSON.stringify([sk]))}::jsonb`));
  }

  // Proficiency → experience_years ranges
  if (proficiency) {
    const clauses = proficiency.split(",").map((p) => p.trim()).map((lv) => {
      if (lv === "Junior") return "experience_years BETWEEN 0 AND 2";
      if (lv === "Mid")    return "experience_years BETWEEN 3 AND 5";
      if (lv === "Senior") return "experience_years > 5";
      return null;
    }).filter(Boolean);
    if (clauses.length) conditions.push(`(${clauses.join(" OR ")})`);
  }

  // Experience bucket
  if (exp_bucket) {
    const clauses = exp_bucket.split(",").map((b) => b.trim()).map((b) => {
      if (b === "0-2") return "experience_years BETWEEN 0 AND 2";
      if (b === "3-5") return "experience_years BETWEEN 3 AND 5";
      if (b === "5-8") return "experience_years BETWEEN 5 AND 8";
      if (b === "10+") return "experience_years >= 10";
      return null;
    }).filter(Boolean);
    if (clauses.length) conditions.push(`(${clauses.join(" OR ")})`);
  }

  // Source (view already has the computed column)
  if (source) {
    const srcs = source.split(",").map((s) => s.trim()).filter(Boolean);
    const clauses = srcs.map((s) => `source = ${push(s)}`);
    if (clauses.length) conditions.push(`(${clauses.join(" OR ")})`);
  }

  // Timeline
  if (timeline) {
    const map = { "24h": "1 day", week: "7 days", month: "30 days" };
    if (map[timeline]) conditions.push(`created_at >= NOW() - INTERVAL '${map[timeline]}'`);
  }

  const SORT_COLS = {
    overall_score: "COALESCE(overall_score, resume_score, 0)",
    created_at:    "created_at",
    full_name:     "full_name",
    resume_score:  "resume_score",
  };
  const sortExpr = SORT_COLS[sort] || "created_at";
  const sortDir  = order === "asc" ? "ASC" : "DESC";
  const where    = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await db.query(
    `SELECT * FROM recruiter_console_view ${where}
     ORDER BY ${sortExpr} ${sortDir} NULLS LAST`,
    values
  );
  res.json(result.rows);
}

// ── Bulk status update (bulk reject / bulk hire) ─────────────────────────────
async function bulkUpdateStatus(req, res) {
  const { ids, status } = req.body;

  const ALLOWED_STATUSES = ["SCREEN_REJECT", "SCREEN_SELECT", "screen_reject", "screen_select", "hired", "rejected", "evaluated", "uploaded", "screening", "PENDING"];
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: "ids array is required" });
  if (!ALLOWED_STATUSES.includes(status))
    return res.status(400).json({ error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` });

  // Validate all IDs are UUIDs to prevent injection
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!ids.every((id) => UUID_RE.test(id)))
    return res.status(400).json({ error: "Invalid candidate ID format" });

  const result = await db.query(
    `UPDATE candidates SET status = $1
     WHERE id = ANY($2::uuid[])
     RETURNING id, status`,
    [status, ids]
  );

  res.json({ updated: result.rowCount, ids: result.rows.map((r) => r.id) });
}

async function getCandidate(req, res) {
  const result = await db.query(
    `SELECT * FROM recruiter_console_view WHERE id = $1`,
    [req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: "Candidate not found" });
  res.json(result.rows[0]);
}

async function sendScreeningTest(req, res) {
  const { id } = req.params;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid candidate ID" });

  const cResult = await db.query(
    `SELECT c.id, c.full_name, c.email, c.status,
            r.id AS resume_id, r.file_path,
            jr.title AS job_role_title
     FROM candidates c
     LEFT JOIN resumes r ON r.candidate_id = c.id
     LEFT JOIN job_roles jr ON jr.id = c.job_role_id
     WHERE c.id = $1
     ORDER BY r.created_at DESC LIMIT 1`,
    [id]
  );
  if (!cResult.rows.length) return res.status(404).json({ error: "Candidate not found" });

  const candidate = cResult.rows[0];

  // Move to screening
  await db.query("UPDATE candidates SET status = 'screening' WHERE id = $1", [id]);

  // Send screening test email
  const emailErr = await sendScreeningTestEmail(
    { id: candidate.id, full_name: candidate.full_name, email: candidate.email },
    candidate.job_role_title
  ).then(() => null).catch((err) => err.message);

  // Trigger AI resume screening if resume exists (fire-and-forget)
  if (candidate.resume_id && candidate.file_path) {
    const AI_BASE      = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const screenUrl    = new URL("/screen-resume", AI_BASE).toString();
    const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";
    fetch(screenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
      body: JSON.stringify({ resume_id: candidate.resume_id, file_path: candidate.file_path }),
    }).catch((err) => console.error("AI screen trigger failed:", err.message));
  }

  res.json({
    message: "Screening test triggered",
    id,
    status: "screening",
    email_sent: !emailErr,
    ...(emailErr && { email_error: emailErr }),
  });
}

module.exports = { registerCandidate, getCandidate, listCandidates, bulkUpdateStatus, sendScreeningTest };