const nodemailer = require('nodemailer');

function getEmailConfig(env = process.env) {
  const smtpHost = String(env.SMTP_HOST || '').trim();
  const smtpPort = Number(env.SMTP_PORT || 0);
  const smtpUser = String(env.SMTP_USER || '').trim();
  const smtpPassword = String(env.SMTP_PASSWORD || '').trim();
  const fromEmail = String(env.EMAIL_FROM_ADDRESS || '').trim();
  const fromName = String(env.EMAIL_FROM_NAME || 'Prode').trim() || 'Prode';
  const secure = String(env.SMTP_SECURE || '').trim().toLowerCase() === 'true'
    || smtpPort === 465;

  return {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    fromEmail,
    fromName,
    secure,
  };
}

function hasEmailTransportConfig(env = process.env) {
  const config = getEmailConfig(env);
  return Boolean(config.smtpHost && config.smtpPort && config.fromEmail);
}

function buildPasswordResetEmail({ toEmail, toName, resetUrl, expiresInMinutes = 60 }) {
  const displayName = String(toName || '').trim() || toEmail;

  return {
    subject: 'Reset your Prode password',
    text: [
      `Hello ${displayName},`,
      '',
      'We received a request to reset your Prode password.',
      `Use the link below within the next ${expiresInMinutes} minutes:`,
      resetUrl,
      '',
      'If you did not request this change, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <p>Hello ${displayName},</p>
        <p>We received a request to reset your Prode password.</p>
        <p>Use the link below within the next ${expiresInMinutes} minutes:</p>
        <p>
          <a href="${resetUrl}" style="color: #0f766e; font-weight: bold;">
            Reset your password
          </a>
        </p>
        <p>If you did not request this change, you can ignore this email.</p>
      </div>
    `.trim(),
  };
}

async function sendPasswordResetEmail({ toEmail, toName, resetUrl, expiresInMinutes = 60 }) {
  const config = getEmailConfig(process.env);

  if (!hasEmailTransportConfig(process.env)) {
    return { sent: false, reason: 'missing_transport_config' };
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.secure,
    ...(config.smtpUser
      ? {
          auth: {
            user: config.smtpUser,
            pass: config.smtpPassword,
          },
        }
      : {}),
  });

  const email = buildPasswordResetEmail({
    toEmail,
    toName,
    resetUrl,
    expiresInMinutes,
  });

  await transporter.sendMail({
    from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  return { sent: true, reason: 'smtp' };
}

module.exports = {
  getEmailConfig,
  hasEmailTransportConfig,
  buildPasswordResetEmail,
  sendPasswordResetEmail,
};
