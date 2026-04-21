const router = require("express").Router();
const csurf  = require("csurf");
const { requireAuth } = require("./admin");
const { sendSMS, receiveSMS, getMessages } = require("../controllers/smsController");

const csrf = csurf({ cookie: { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", secure: process.env.NODE_ENV === "production" } });

// Protected: recruiter-only
router.get("/:candidate_id", requireAuth, getMessages);
router.post("/send",         requireAuth, csrf, sendSMS);

// Public webhook — Twilio calls this (no CSRF, validate Twilio signature instead)
router.post("/receive", receiveSMS);

module.exports = router;
