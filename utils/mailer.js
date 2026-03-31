const nodemailer = require('nodemailer');

function createTransporter() {
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true';

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Thiếu cấu hình SMTP_USER hoặc SMTP_PASS trong .env');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendMail({ to, subject, html, text }) {
  const allowConsoleFallback = String(process.env.MAIL_ALLOW_CONSOLE_FALLBACK || 'false').toLowerCase() === 'true';

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html
    });
  } catch (error) {
    if (!allowConsoleFallback) {
      throw error;
    }

    console.warn('SMTP failed, using console fallback instead.');
    console.warn(`TO: ${to}`);
    console.warn(`SUBJECT: ${subject}`);
    console.warn(`TEXT: ${text}`);
  }
}

module.exports = { sendMail };
