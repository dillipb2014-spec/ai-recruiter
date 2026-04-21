// SMS provider removed — WhatsApp is handled directly via web.whatsapp.com links in the UI
exports.send = async (to, body) => {
  console.log(`[SMS] Message to ${to}: ${body}`);
  return { sid: null, status: "logged" };
};
