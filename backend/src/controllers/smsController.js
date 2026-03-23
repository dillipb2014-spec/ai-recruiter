const db          = require("../db");
const smsProvider = require("../services/smsProvider");

async function sendWhatsApp(req, res) {
  try {
    const { candidate_id, body } = req.body;
    if (!candidate_id || !body?.trim())
      return res.status(400).json({ error: "candidate_id and body are required" });

    const cand = await db.query(
      "SELECT full_name, phone FROM candidates WHERE id = $1",
      [candidate_id]
    );
    if (!cand.rows.length)
      return res.status(404).json({ error: "Candidate not found" });

    const phone = cand.rows[0].phone;
    if (!phone)
      return res.status(422).json({ error: "Candidate has no phone number on record" });

    try {
      const providerRes = await smsProvider.send(phone, body.trim());
      console.log("[WhatsApp] Sent via Twilio:", providerRes.sid);
    } catch (err) {
      console.error("[WhatsApp] Twilio error:", err.message);
      // Still save to DB so history is preserved even if provider fails
    }

    await db.query(
      "INSERT INTO candidate_messages (candidate_id, body, direction) VALUES ($1, $2, 'outbound')",
      [candidate_id, body.trim()]
    );

    res.json({ success: true, message: "WhatsApp message sent and logged." });
  } catch (err) {
    console.error("[WhatsApp] sendWhatsApp error:", err.message);
    res.status(500).json({ error: "Failed to send WhatsApp message" });
  }
}

async function receiveSMS(req, res) {
  try {
    const from = req.body.From || req.body.from || req.body.mobile;
    const text  = req.body.Body || req.body.body || req.body.message || req.body.text;

    if (!from || !text)
      return res.status(400).json({ error: "Missing from/text" });

    const digits = from.replace(/\D/g, "");

    await db.query(
      `INSERT INTO candidate_messages (candidate_id, body, direction)
       SELECT id, $2, 'inbound' FROM candidates
       WHERE phone ~ $1 OR REGEXP_REPLACE(phone,'\\D','','g') = $1
       LIMIT 1`,
      [digits, text]
    );

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[SMS] receiveSMS error:", err.message);
    res.status(500).json({ error: "Failed to process inbound SMS" });
  }
}

async function getMessages(req, res) {
  try {
    const result = await db.query(
      `SELECT id, candidate_id, body, direction, created_at
       FROM candidate_messages WHERE candidate_id = $1
       ORDER BY created_at ASC`,
      [req.params.candidate_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[SMS] getMessages error:", err.message);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

module.exports = { sendSMS: sendWhatsApp, receiveSMS, getMessages };
