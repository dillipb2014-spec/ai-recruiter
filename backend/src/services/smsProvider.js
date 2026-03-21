// Swap this implementation for your SMS provider (Twilio, MSG91, etc.)
// Twilio example:
//   const twilio = require("twilio")(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
//   exports.send = (to, body) => twilio.messages.create({ from: process.env.TWILIO_FROM, to, body });

exports.send = async (to, body) => {
  // Stub: logs the outbound SMS — replace with real provider call
  console.log(`[SMS] → ${to}: ${body}`);
  return { sid: `stub_${Date.now()}`, status: "sent" };
};
