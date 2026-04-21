const router  = require("express").Router();
const csurf   = require("csurf");
const multer  = require("multer");
const path    = require("path");
const { requireAuth } = require("./admin");
const { bulkUpload, getBulkUpload } = require("../controllers/bulkUploadController");

const csrf = csurf({ cookie: { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", secure: process.env.NODE_ENV === "production" } });

const xlsxUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    [".xlsx", ".xls", ".csv"].includes(ext)
      ? cb(null, true)
      : cb(new Error("Only Excel/CSV files allowed"), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post("/:roleId",        requireAuth, csrf, xlsxUpload.single("file"), bulkUpload);
router.get("/:bulkId/status",  requireAuth, getBulkUpload);

module.exports = router;
