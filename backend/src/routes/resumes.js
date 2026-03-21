const router = require("express").Router();
const csurf  = require("csurf");
const upload = require("../middleware/upload");
const { uploadResume, getResume } = require("../controllers/resumeController");

const csrfProtection = csurf({ cookie: { httpOnly: true, sameSite: "lax" } });

const handleMulterError = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    if (err.code === "LIMIT_FILE_SIZE")
      return res.status(400).json({ error: "File exceeds 5MB limit" });
    if (err.message.includes("Only PDF"))
      return res.status(400).json({ error: err.message });
    next(err);
  }
};

// POST /api/resumes/:candidateId
router.post(
  "/:candidateId",
  csrfProtection,
  (req, res, next) => upload.single("resume")(req, res, (err) => {
    if (err) return handleMulterError(() => { throw err; })(req, res, next);
    next();
  }),
  handleMulterError(uploadResume)
);

// GET /api/resumes/:candidateId
router.get("/:candidateId", handleMulterError(getResume));

module.exports = router;
