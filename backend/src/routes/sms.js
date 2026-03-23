const router = require("express").Router();
const { sendSMS, receiveSMS, getMessages } = require("../controllers/smsController");
const sendWhatsApp = sendSMS;

router.get("/:candidate_id",  getMessages);
router.post("/send",          sendWhatsApp);
router.post("/receive",       receiveSMS); // webhook — no CSRF (provider calls this)

module.exports = router;
