const router  = require("express").Router();
const csurf   = require("csurf");
const multer  = require("multer");
const path    = require("path");
const { v4: uuidv4 } = require("uuid");
const { bulkUpload, getBulkUpload } = require("../controllers/bulkUploadController");

const csrfProtection = csurf({ cookie: { httpOnly: true, sameSite: "lax" } });

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");
const xlsxUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename:    (req, file, cb) => cb(null, `${uuidv4()}.xlsx`),
  }),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    [".xlsx", ".xls", ".csv"].includes(ext)
      ? cb(null, true)
      : cb(new Error("Only Excel/CSV files allowed"), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post("/:roleId", csrfProtection, xlsxUpload.single("file"), bulkUpload);
router.get("/:bulkId/status", getBulkUpload);

module.exports = router;
