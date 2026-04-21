const router = require("express").Router();
const csurf  = require("csurf");
const upload = require("../middleware/upload");
const { requireAuth } = require("./admin");
const { uploadResume, getResume, serveResumeFile } = require("../controllers/resumeController");

const csrf = csurf({ cookie: { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", secure: process.env.NODE_ENV === "production" } });

const handleMulterError = (fn) => async (req, res, next) => {
  try { await fn(req, res, next); }
  catch (err) {
    if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File exceeds 5MB limit" });
    if (err.message?.includes("Only PDF")) return res.status(400).json({ error: err.message });
    next(err);
  }
};

// POST /api/resumes/:candidateId — candidate uploads their own resume (public with CSRF)
router.post(
  "/:candidateId",
  csrf,
  (req, res, next) => upload.single("resume")(req, res, (err) => {
    if (err) return handleMulterError(() => { throw err; })(req, res, next);
    next();
  }),
  handleMulterError(uploadResume)
);

// GET /api/resumes/file/:resumeId — allow AI service (internal key) OR authenticated recruiter
router.get("/file/:resumeId", (req, res, next) => {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (internalKey && req.headers["x-internal-key"] === internalKey) return next();
  requireAuth(req, res, next);
}, serveResumeFile);

// GET /api/resumes/:candidateId — recruiter only
router.get("/:candidateId", requireAuth, handleMulterError(getResume));

module.exports = router;
