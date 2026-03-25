require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const cookieParser = require("cookie-parser");
const csurf        = require("csurf");
const path         = require("path");
const fs           = require("fs");

const app = express();

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_DIR || "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Middleware ──────────────────────────────────────────
const _origins = (process.env.ALLOWED_ORIGIN || "http://localhost:3000").split(",").map((o) => o.trim());
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || _origins.includes(origin)),
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
// Serve uploads — validate PDF magic bytes before serving
app.use("/uploads", (req, res, next) => {
  const filePath = path.resolve(path.join(uploadDir, req.path));
  if (!filePath.startsWith(path.resolve(uploadDir))) return res.status(403).end();
  if (!fs.existsSync(filePath)) return res.status(404).end();
  const buf = Buffer.alloc(5);
  const fd  = fs.openSync(filePath, "r");
  fs.readSync(fd, buf, 0, 5, 0);
  fs.closeSync(fd);
  if (buf.toString("ascii") !== "%PDF-") {
    return res.status(422).json({ error: "File is not a valid PDF. The Google Drive link was not publicly shared." });
  }
  next();
}, express.static(path.resolve(uploadDir)));

// ── CSRF token endpoint (frontend fetches this on load) ─
const csrfProtection = csurf({ cookie: { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", secure: process.env.NODE_ENV === "production" } });
app.get("/api/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// ── Routes ──────────────────────────────────────────────
app.use("/api/candidates",   require("./routes/candidates"));
app.use("/api/resumes",      require("./routes/resumes"));
app.use("/api/job-roles",    require("./routes/jobRoles"));
app.use("/api/bulk-upload",  require("./routes/bulkUpload"));
app.use("/api/interviews",   require("./routes/interviews"));
app.use("/api/admin",        require("./routes/admin"));
app.use("/api/sms",          require("./routes/sms"));

// Proxy scorecard from AI service
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";
const AI_BASE      = process.env.AI_SERVICE_URL || "http://localhost:8000";

// Proxy: parse JD via AI service
app.post("/api/parse-jd", async (req, res) => {
  try {
    const { FormData, Blob } = await import("node:buffer").catch(() => ({}));
    // Forward raw body as multipart to AI service
    const contentType = req.headers["content-type"] || "";
    const response = await fetch(`${AI_BASE}/parse-jd`, {
      method: "POST",
      headers: { "content-type": contentType, "X-Internal-Key": INTERNAL_KEY },
      body: await new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end",  () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/candidates/:id/scorecard", async (req, res) => {
  try {
    const r = await fetch(`${AI_BASE}/scorecard/${encodeURIComponent(req.params.id)}`, {
      headers: { "X-Internal-Key": INTERNAL_KEY },
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy: screening test questions + evaluation
app.get("/api/screening-test/:candidateId/questions", async (req, res) => {
  try {
    const r = await fetch(`${AI_BASE}/screening-test/${encodeURIComponent(req.params.candidateId)}/questions`, {
      headers: { "X-Internal-Key": INTERNAL_KEY },
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/screening-test/:candidateId/evaluate", async (req, res) => {
  try {
    const r = await fetch(`${AI_BASE}/screening-test/${encodeURIComponent(req.params.candidateId)}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

// ── Global error handler ────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN")
    return res.status(403).json({ error: "Invalid CSRF token" });
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
