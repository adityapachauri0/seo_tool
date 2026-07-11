/**
 * Email delivery for alerts and reports.
 * Uses SMTP creds from env; silently no-ops (with a console warn) if not configured.
 */

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[MAIL] SMTP not configured — email delivery disabled');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

async function sendMail(subject, text) {
  const t = getTransporter();
  const to = process.env.ALERT_EMAIL;
  if (!t || !to) return false;
  try {
    await t.sendMail({
      from: `"SEO Command Center" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });
    console.log(`[MAIL] Sent: ${subject}`);
    return true;
  } catch (err) {
    console.error(`[MAIL] Failed to send "${subject}":`, err.message);
    return false;
  }
}

module.exports = { sendMail };
