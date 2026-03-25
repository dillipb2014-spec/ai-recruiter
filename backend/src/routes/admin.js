const express    = require("express");
const db         = require("../db");
const crypto     = require("crypto");
const { sendScreeningTest } = require("../controllers/candidateController");

const router = express.Router();

// Simple in-memory session store
const sessions = new Map();

function createSession(recruiter) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { id: recruiter.id, name: recruiter.name, email: recruiter.email, role: recruiter.role });
  setTimeout(() => sessions.delete(token), 8 * 60 * 60 * 1000); // 8h expiry
  return token;
}

function getSession(req) {
  const token = req.cookies?.["auth_token"];
  return token ? sessions.get(token) : null;
}

// Middleware — protect recruiter routes
function requireAuth(req, res, next) {
  if (!getSession(req)) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// POST /api/admin/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const result = await db.query("SELECT * FROM recruiters WHERE email = $1", [email]);
  if (!result.rows.length) return res.status(401).json({ error: "Invalid credentials" });

  const recruiter = result.rows[0];
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  if (hash !== recruiter.password_hash) return res.status(401).json({ error: "Invalid credentials" });

  const token = createSession(recruiter);
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 8 * 60 * 60 * 1000,
  });
  res.json({ name: recruiter.name, email: recruiter.email, role: recruiter.role });
});

// POST /api/admin/logout
router.post("/logout", (req, res) => {
  const token = req.cookies?.["auth_token"];
  if (token) sessions.delete(token);
  res.clearCookie("auth_token");
  res.json({ ok: true });
});

// GET /api/admin/me
router.get("/me", (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  res.json(session);
});

// POST /api/admin/register — create first recruiter account
router.post("/register", async (req, res) => {
  const { name, email, password, secret } = req.body;
  if (secret !== (process.env.ADMIN_SECRET || "juspay_ai_recruiter_admin"))
    return res.status(403).json({ error: "Invalid admin secret" });
  if (!name || !email || !password) return res.status(400).json({ error: "name, email, password required" });

  const hash = crypto.createHash("sha256").update(password).digest("hex");
  const result = await db.query(
    `INSERT INTO recruiters (name, email, password_hash, role) VALUES ($1,$2,$3,'recruiter')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, name, email, role`,
    [name, email, hash]
  );
  res.json(result.rows[0]);
});

// ── POST /api/admin/send-screening/:id ───────────────────────────────────────
router.post("/send-screening/:id", requireAuth, sendScreeningTest);

module.exports = { router, requireAuth, getSession };
