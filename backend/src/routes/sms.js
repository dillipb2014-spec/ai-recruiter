const router = require("express").Router();
const { sendSMS, receiveSMS, getMessages } = require("../controllers/smsController");

router.get("/:candidate_id",  getMessages);
router.post("/send",          sendSMS);
router.post("/receive",       receiveSMS); // webhook — no CSRF (provider calls this)

module.exports = router;
