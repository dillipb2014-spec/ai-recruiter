const express    = require("express");
const db         = require("../db");
const { sendScreeningTest } = require("../controllers/candidateController");

const router     = express.Router();
const INTERNAL_KEY  = process.env.INTERNAL_API_KEY || "";
const AI_BASE       = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SCREEN_URL = new URL("/screen-resume", AI_BASE).toString();
const DELAY_MS      = 500;

// ── POST /api/admin/send-screening/:id ───────────────────────────────────────
router.post("/send-screening/:id", sendScreeningTest);

// ── POST /api/admin/bulk-scan ─────────────────────────────────────────────────
router.post("/bulk-scan", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.id AS candidate_id, r.id AS resume_id, r.file_path
      FROM candidates c
      JOIN resumes r ON r.candidate_id = c.id
      WHERE r.file_path IS NOT NULL
        AND r.id = (
          SELECT id FROM resumes r2
          WHERE r2.candidate_id = c.id
          ORDER BY r2.created_at DESC
          LIMIT 1
        )
      ORDER BY c.created_at DESC
    `);

    res.json({ total: rows.length, message: "Bulk scan started", candidates: rows.map((r) => r.candidate_id) });

    // Fire-and-forget after response is sent
    (async () => {
      for (const row of rows) {
        try {
          await db.query("UPDATE candidates SET status = 'screening' WHERE id = $1", [row.candidate_id]);
          const response = await fetch(AI_SCREEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
            body: JSON.stringify({ resume_id: row.resume_id, file_path: row.file_path }),
          });
          if (!response.ok)
            console.error(`Bulk scan: AI error for ${row.candidate_id}: ${response.status}`);
        } catch (err) {
          console.error(`Bulk scan: failed for ${row.candidate_id}:`, err.message);
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
      console.log(`Bulk scan complete: ${rows.length} candidates processed`);
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/bulk-scan/status ──────────────────────────────────────────
router.get("/bulk-scan/status", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'screening')     AS pending,
        COUNT(*) FILTER (WHERE status = 'screen_select') AS selected,
        COUNT(*) FILTER (WHERE status = 'screen_reject') AS rejected,
        COUNT(*) AS total
      FROM candidates
      WHERE id = ANY(
        SELECT candidate_id FROM resumes WHERE file_path IS NOT NULL
      )
    `);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
