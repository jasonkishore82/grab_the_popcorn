// Sends email through Resend (HTTP API) or any SMTP server such as Zoho Mail. With neither set up,
// the message is printed to the server console so sign-up still works while developing.
import './env.js';

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);

let transporter;
async function smtp() {
  if (!transporter) {
    const { default: nodemailer } = await import('nodemailer');
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === '1' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  const from = process.env.EMAIL_FROM || 'Grab the Popcorn <onboarding@resend.dev>';
  if (process.env.RESEND_API_KEY) {
    const res = await fetch(`${process.env.RESEND_BASE_URL || 'https://api.resend.com'}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Resend refused the email (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return { sent: true };
  }
  if (process.env.SMTP_HOST) {
    await (await smtp()).sendMail({ from, to, subject, text, html });
    return { sent: true };
  }
  console.log(`\n[email not configured, printing instead]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
  return { sent: false };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function layout(heading, lines, buttonText, url) {
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#121212">
<h2 style="margin:0 0 12px">${esc(heading)}</h2>
${lines.map((l) => `<p style="line-height:1.5">${esc(l)}</p>`).join('')}
<p><a href="${esc(url)}" style="display:inline-block;background:#d90511;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${esc(buttonText)}</a></p>
<p style="color:#80808a;font-size:13px">If the button does not work, paste this link into your browser:<br>${esc(url)}</p></div>`;
  const text = `${heading}\n\n${lines.join('\n\n')}\n\n${buttonText}: ${url}\n`;
  return { html, text };
}

export const verifyEmail = (name, url) =>
  layout(`Welcome, ${name}`, ['Confirm your email address so you can reset your password if you ever need to.', 'This link works for 24 hours.'], 'Confirm email', url);
export const resetEmail = (name, url) =>
  layout('Reset your password', [`Hi ${name}, we got a request to reset your Grab the Popcorn password.`, 'This link works for one hour. If it was not you, ignore this email and nothing changes.'], 'Choose a new password', url);
