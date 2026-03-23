const twilio = require("twilio")(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

exports.send = async (to, body) => {
  const msg = await twilio.messages.create({
    from: "whatsapp:+14155238886",
    to:   `whatsapp:${to}`,
    body,
  });
  return { sid: msg.sid, status: msg.status };
};
