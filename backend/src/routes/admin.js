const express    = require("express");
const db         = require("../db");
const { sendScreeningTest } = require("../controllers/candidateController");

const router = express.Router();

// ── POST /api/admin/send-screening/:id ───────────────────────────────────────
router.post("/send-screening/:id", sendScreeningTest);

module.exports = router;
