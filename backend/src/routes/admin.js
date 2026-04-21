const express    = require("express");
const db         = require("../db");
const crypto     = require("crypto");
const bcrypt     = require("bcrypt");
const rateLimit  = require("express-rate-limit");
const { sendScreeningTest } = require("../controllers/candidateController");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

async function createSession(recruiter) {
  const token     = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4h
  await db.query(
    `INSERT INTO recruiter_sessions (token, recruiter_id, data, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [token, recruiter.id, JSON.stringify({ id: recruiter.id, name: recruiter.name, email: recruiter.email, role: recruiter.role }), expiresAt]
  );
  return token;
}

async function getSession(req) {
  const token = req.cookies?.["auth_token"];
  if (!token) return null;
  const result = await db.query(
    "SELECT data FROM recruiter_sessions WHERE token = $1 AND expires_at > NOW()",
    [token]
  );
  return result.rows.length ? result.rows[0].data : null;
}

async function requireAuth(req, res, next) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// POST /api/admin/login
router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const result = await db.query("SELECT * FROM recruiters WHERE email = $1", [email]);
  if (!result.rows.length) return res.status(401).json({ error: "Invalid credentials" });

  const recruiter = result.rows[0];

  // Support both bcrypt and legacy SHA256 hashes (migration path)
  let valid = false;
  if (recruiter.password_hash.startsWith("$2")) {
    valid = await bcrypt.compare(password, recruiter.password_hash);
  } else {
    // Legacy SHA256 — verify then upgrade to bcrypt
    const sha = crypto.createHash("sha256").update(password).digest("hex");
    valid = sha === recruiter.password_hash;
    if (valid) {
      const newHash = await bcrypt.hash(password, 12);
      await db.query("UPDATE recruiters SET password_hash = $1 WHERE id = $2", [newHash, recruiter.id]);
    }
  }

  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = await createSession(recruiter);
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 4 * 60 * 60 * 1000,
  });
  res.json({ name: recruiter.name, email: recruiter.email, role: recruiter.role });
});

// POST /api/admin/logout
router.post("/logout", async (req, res) => {
  const token = req.cookies?.["auth_token"];
  if (token) await db.query("DELETE FROM recruiter_sessions WHERE token = $1", [token]);
  res.clearCookie("auth_token");
  res.json({ ok: true });
});

// GET /api/admin/me
router.get("/me", async (req, res) => {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  res.json(session);
});

// POST /api/admin/register — requires ADMIN_SECRET env var (no fallback)
router.post("/register", async (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return res.status(503).json({ error: "Registration not configured" });

  const { name, email, password, secret } = req.body;
  if (secret !== adminSecret) return res.status(403).json({ error: "Invalid admin secret" });
  if (!name || !email || !password) return res.status(400).json({ error: "name, email, password required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const hash   = await bcrypt.hash(password, 12);
  const result = await db.query(
    `INSERT INTO recruiters (name, email, password_hash, role) VALUES ($1,$2,$3,'recruiter')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, name, email, role`,
    [name, email, hash]
  );
  res.json(result.rows[0]);
});

// POST /api/admin/send-screening/:id
router.post("/send-screening/:id", requireAuth, sendScreeningTest);

module.exports = { router, requireAuth, getSession };
