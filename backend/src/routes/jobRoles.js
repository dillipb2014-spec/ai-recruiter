const router = require("express").Router();
const csurf  = require("csurf");
const upload = require("../middleware/upload");
const { requireAuth } = require("./admin");
const { createJobRole, bulkCreateJobRoles, updateJobRole, listJobRoles, getJobRole } = require("../controllers/jobRoleController");
const { uploadResumeForRole } = require("../controllers/resumeController");

const csrf = csurf({ cookie: { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", secure: process.env.NODE_ENV === "production" } });

const handleMulterError = (fn) => async (req, res, next) => {
  try { await fn(req, res, next); }
  catch (err) {
    if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File exceeds 5MB limit" });
    if (err.message?.includes("Only PDF")) return res.status(400).json({ error: err.message });
    next(err);
  }
};

// Public: candidates need to fetch roles when applying
router.get("/",    listJobRoles);
router.get("/:id", getJobRole);

// Protected: recruiter-only
router.post("/",     requireAuth, csrf, createJobRole);
router.post("/bulk", requireAuth, csrf, bulkCreateJobRoles);
router.put("/:id",   requireAuth, csrf, updateJobRole);

router.post(
  "/:roleId/upload",
  requireAuth, csrf,
  (req, res, next) => upload.single("resume")(req, res, (err) => {
    if (err) return handleMulterError(() => { throw err; })(req, res, next);
    next();
  }),
  handleMulterError(uploadResumeForRole)
);

module.exports = router;
