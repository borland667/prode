import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildPasswordResetEmail,
  getEmailConfig,
  hasEmailTransportConfig,
} = require('../api/email.cjs');

test('getEmailConfig normalizes SMTP and sender settings', () => {
  const config = getEmailConfig({
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_USER: 'mailer',
    SMTP_PASSWORD: 'secret',
    EMAIL_FROM_ADDRESS: 'noreply@example.com',
    EMAIL_FROM_NAME: 'Prode Mailer',
    SMTP_SECURE: 'false',
  });

  assert.deepEqual(config, {
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    smtpUser: 'mailer',
    smtpPassword: 'secret',
    fromEmail: 'noreply@example.com',
    fromName: 'Prode Mailer',
    secure: false,
  });
});

test('hasEmailTransportConfig requires SMTP host, port, and sender address', () => {
  assert.equal(
    hasEmailTransportConfig({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '1025',
      EMAIL_FROM_ADDRESS: 'noreply@example.com',
    }),
    true
  );

  assert.equal(
    hasEmailTransportConfig({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '1025',
    }),
    false
  );
});

test('buildPasswordResetEmail creates a usable subject and body', () => {
  const email = buildPasswordResetEmail({
    toEmail: 'user@example.com',
    toName: 'Test User',
    resetUrl: 'http://localhost:5173/reset-password?token=abc123',
    expiresInMinutes: 60,
  });

  assert.match(email.subject, /reset your prode password/i);
  assert.match(email.text, /Test User/);
  assert.match(email.text, /abc123/);
  assert.match(email.html, /Reset your password/);
  assert.match(email.html, /http:\/\/localhost:5173\/reset-password\?token=abc123/);
});
