const db = require("../db");

async function createJobRole(req, res) {
  const { title, original_jd_text, key_points, mandatory_skills } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const result = await db.query(
    `INSERT INTO job_roles (title, original_jd_text, key_points, mandatory_skills)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, original_jd_text, key_points, mandatory_skills, created_at`,
    [title, original_jd_text || null, JSON.stringify(key_points || []), JSON.stringify(mandatory_skills || [])]
  );
  res.status(201).json(result.rows[0]);
}

async function updateJobRole(req, res) {
  const { title, original_jd_text, key_points, mandatory_skills } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const result = await db.query(
    `UPDATE job_roles SET title=$1, original_jd_text=$2, key_points=$3, mandatory_skills=$4
     WHERE id=$5
     RETURNING id, title, original_jd_text, key_points, mandatory_skills, created_at`,
    [title, original_jd_text || null, JSON.stringify(key_points || []), JSON.stringify(mandatory_skills || []), req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: "Job role not found" });
  res.json(result.rows[0]);
}

async function listJobRoles(req, res) {
  const result = await db.query(
    `SELECT id, title, original_jd_text, key_points, mandatory_skills, created_at
     FROM job_roles ORDER BY created_at DESC`
  );
  res.json(result.rows);
}

async function getJobRole(req, res) {
  const result = await db.query(
    `SELECT id, title, original_jd_text, key_points, mandatory_skills, created_at
     FROM job_roles WHERE id = $1`,
    [req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: "Job role not found" });
  res.json(result.rows[0]);
}

async function bulkCreateJobRoles(req, res) {
  const { roles } = req.body;
  if (!Array.isArray(roles) || roles.length === 0)
    return res.status(400).json({ error: "roles array is required" });
  const results = [];
  for (const role of roles) {
    const { title, original_jd_text, key_points, mandatory_skills } = role;
    if (!title?.trim()) continue;
    const r = await db.query(
      `INSERT INTO job_roles (title, original_jd_text, key_points, mandatory_skills)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, created_at`,
      [title.trim(), original_jd_text || null, JSON.stringify(key_points || []), JSON.stringify(mandatory_skills || [])]
    );
    results.push(r.rows[0]);
  }
  res.status(201).json({ created: results.length, roles: results });
}

module.exports = { createJobRole, bulkCreateJobRoles, updateJobRole, listJobRoles, getJobRole };
