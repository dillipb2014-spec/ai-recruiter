const db = require("../db");

async function sendWhatsApp(req, res) {
  const { candidate_id, body } = req.body;
  if (!candidate_id || !body?.trim())
    return res.status(400).json({ error: "candidate_id and body are required" });

  const cand = await db.query("SELECT full_name, phone FROM candidates WHERE id = $1", [candidate_id]);
  if (!cand.rows.length) return res.status(404).json({ error: "Candidate not found" });

  await db.query(
    "INSERT INTO candidate_messages (candidate_id, body, direction) VALUES ($1, $2, 'outbound')",
    [candidate_id, body.trim()]
  );

  res.json({ success: true, message: "Message logged." });
}

async function receiveSMS(req, res) {
  const from = req.body.From || req.body.from || req.body.mobile;
  const text  = req.body.Body || req.body.body || req.body.message || req.body.text;
  if (!from || !text) return res.status(400).json({ error: "Missing from/text" });

  const digits = from.replace(/\D/g, "");
  await db.query(
    `INSERT INTO candidate_messages (candidate_id, body, direction)
     SELECT id, $2, 'inbound' FROM candidates
     WHERE REGEXP_REPLACE(phone,'\\D','','g') = $1 LIMIT 1`,
    [digits, text]
  );
  res.status(200).json({ received: true });
}

async function getMessages(req, res) {
  const result = await db.query(
    `SELECT id, candidate_id, body, direction, created_at
     FROM candidate_messages WHERE candidate_id = $1 ORDER BY created_at ASC`,
    [req.params.candidate_id]
  );
  res.json(result.rows);
}

module.exports = { sendSMS: sendWhatsApp, receiveSMS, getMessages };
