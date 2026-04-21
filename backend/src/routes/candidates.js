const router = require("express").Router();
const csurf  = require("csurf");
const multer = require("multer");
const path   = require("path");
const db     = require("../db");
const { requireAuth } = require("./admin");
const { registerCandidate, getCandidate, listCandidates, bulkUpdateStatus } = require("../controllers/candidateController");
const { sendRejectionEmails } = require("../services/emailService");

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const upload = multer({ dest: path.resolve(UPLOAD_DIR) });
const csrf = csurf({ cookie: { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", secure: process.env.NODE_ENV === "production" } });

// Public: candidate self-registration
router.post("/", upload.single("resume"), csrf, registerCandidate);

// Protected: recruiter-only
router.get("/",              requireAuth, listCandidates);
router.put("/bulk-status",   requireAuth, csrf, bulkUpdateStatus);

router.post("/send-rejections", requireAuth, csrf, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: "ids array is required" });
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!ids.every((id) => UUID_RE.test(id)))
    return res.status(400).json({ error: "Invalid ID format" });
  const result = await db.query(
    `SELECT c.full_name, c.email, jr.title AS job_role_title
     FROM candidates c
     LEFT JOIN job_roles jr ON jr.id = c.job_role_id
     WHERE c.id = ANY($1::uuid[])`,
    [ids]
  );
  try {
    res.json(await sendRejectionEmails(result.rows));
  } catch (err) {
    res.status(500).json({ error: "Email send failed" });
  }
});

router.get("/:id", requireAuth, getCandidate);

module.exports = router;
