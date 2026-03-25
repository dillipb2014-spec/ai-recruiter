const https = require("https");

const FROM = process.env.SMTP_FROM || "Juspay AI Recruiter <onboarding@resend.dev>";
// NOTE: Resend free tier only allows sending from onboarding@resend.dev unless domain is verified

async function _sendViaResend(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const body = JSON.stringify({ from: FROM, to, subject, html });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.resend.com",
      path: "/emails",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
        else reject(new Error(`Resend API error ${res.statusCode}: ${data}`));
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function _rejectionHtml(name, role) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#111827;max-width:560px;margin:0 auto;padding:32px 24px">
  <p style="margin:0 0 24px;font-size:13px;color:#6b7280">JUSPAY AI · Recruitment Team</p>
  <p style="margin:0 0 16px;font-size:15px">Dear ${name},</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#374151">
    Thank you for your interest in the <strong>${role || "position"}</strong> role at Juspay.
    After careful review, we will not be moving forward with your application at this time.
  </p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#374151">
    We appreciate the effort you invested and wish you every success in your future endeavours.
  </p>
  <p style="margin:0;font-size:14px;font-weight:600">The Recruitment Team, JUSPAY AI</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
  <p style="margin:0;font-size:11px;color:#9ca3af">This is an automated message. Please do not reply.</p>
</body></html>`;
}

function _screeningHtml(name, role, link) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#111827;max-width:560px;margin:0 auto;padding:32px 24px">
  <p style="margin:0 0 24px;font-size:13px;color:#6b7280">JUSPAY AI · Recruitment Team</p>
  <p style="margin:0 0 16px;font-size:15px">Dear ${name},</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#374151">
    Thank you for applying for the <strong>${role || "position"}</strong> role at Juspay.
    Your application has been received successfully.
  </p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#374151">
    As the next step, please complete a short technical screening test.
  </p>
  <a href="${link}" style="display:inline-block;margin:8px 0 24px;padding:12px 28px;background:#0052cc;color:#fff;border-radius:7px;font-size:14px;font-weight:600;text-decoration:none">Start Screening Test →</a>
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Or copy: <span style="color:#0052cc">${link}</span></p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
  <p style="margin:0;font-size:11px;color:#9ca3af">This is an automated message. Please do not reply.</p>
</body></html>`;
}

async function sendScreeningTestEmail(candidate, jobRoleTitle) {
  const link = `${process.env.APP_URL || "http://localhost:3000"}/screening-test/${candidate.id}`;
  await _sendViaResend(
    candidate.email,
    `Next Step: Screening Test — ${jobRoleTitle || "Position"}`,
    _screeningHtml(candidate.full_name, jobRoleTitle, link)
  );
}

async function sendRejectionEmails(candidates) {
  let sent = 0, failed = 0;
  const errors = [];
  for (const c of candidates) {
    try {
      await _sendViaResend(
        c.email,
        `Your Application Update — ${c.job_role_title || "Position"}`,
        _rejectionHtml(c.full_name, c.job_role_title)
      );
      sent++;
    } catch (err) {
      failed++;
      errors.push(`${c.email}: ${err.message}`);
    }
  }
  return { sent, failed, errors };
}

module.exports = { sendRejectionEmails, sendScreeningTestEmail };
