const router = require("express").Router();
const csurf  = require("csurf");
const upload = require("../middleware/upload");
const { createJobRole, bulkCreateJobRoles, updateJobRole, listJobRoles, getJobRole } = require("../controllers/jobRoleController");
const { uploadResumeForRole } = require("../controllers/resumeController");

const csrfProtection = csurf({ cookie: { httpOnly: true, sameSite: "lax" } });

const handleMulterError = (fn) => async (req, res, next) => {
  try { await fn(req, res, next); }
  catch (err) {
    if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File exceeds 5MB limit" });
    if (err.message?.includes("Only PDF")) return res.status(400).json({ error: err.message });
    next(err);
  }
};

router.get("/",     listJobRoles);
router.get("/:id",  getJobRole);
router.post("/", csrfProtection, createJobRole);
router.post("/bulk", csrfProtection, bulkCreateJobRoles);
router.put("/:id", csrfProtection, updateJobRole);

// POST /api/job-roles/:roleId/upload  — upload a resume against a specific role
router.post(
  "/:roleId/upload",
  csrfProtection,
  (req, res, next) => upload.single("resume")(req, res, (err) => {
    if (err) return handleMulterError(() => { throw err; })(req, res, next);
    next();
  }),
  handleMulterError(uploadResumeForRole)
);

module.exports = router;
