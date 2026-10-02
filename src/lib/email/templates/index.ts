/**
 * Responsive branded email templates for GhumneChalo authentication & security
 */

interface BaseEmailProps {
  name?: string | null;
  appName?: string;
}

export interface VerificationEmailProps extends BaseEmailProps {
  otp: string;
  expiresInMinutes?: number;
}

export interface TwoFactorEmailProps extends BaseEmailProps {
  otp: string;
  expiresInMinutes?: number;
  isSetup?: boolean;
}

export interface PasswordResetEmailProps extends BaseEmailProps {
  resetUrl: string;
  expiresInMinutes?: number;
}

export interface SecurityAlertEmailProps extends BaseEmailProps {
  eventName: string;
  details: string;
  timestamp?: string;
}

const BRAND_COLOR = '#059669'; // Emerald 600
const BRAND_DARK = '#0f172a'; // Slate 900
const BRAND_BG = '#f8fafc'; // Slate 50

function wrapInLayout(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: ${BRAND_BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; }
    .wrapper { max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #ffffff; padding: 28px 32px 20px; border-bottom: 1px solid #f1f5f9; text-align: center; }
    .brand-title { font-size: 22px; font-weight: 800; color: ${BRAND_DARK}; margin: 0; letter-spacing: -0.02em; }
    .brand-subtitle { font-size: 12px; color: ${BRAND_COLOR}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }
    .body { padding: 32px; }
    .h1 { font-size: 20px; font-weight: 700; color: ${BRAND_DARK}; margin: 0 0 12px; }
    .text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px; }
    .otp-box { background: #f0fdf4; border: 2px dashed #bbf7d0; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #166534; margin: 0; }
    .btn { display: inline-block; background: ${BRAND_COLOR}; color: #ffffff !important; font-weight: 600; font-size: 14px; padding: 14px 28px; border-radius: 10px; text-decoration: none; margin: 20px 0; }
    .alert-box { background: #fef2f2; border: 1px solid #fee2e2; border-radius: 10px; padding: 16px; margin: 20px 0; }
    .alert-text { font-size: 13px; color: #991b1b; line-height: 1.5; margin: 0; }
    .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-title">GhumneChalo</div>
      <div class="brand-subtitle">AI-Powered Travel Planning</div>
    </div>
    <div class="body">
      ${contentHtml}
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px;">&copy; ${new Date().getFullYear()} GhumneChalo. All rights reserved.</p>
      <p style="margin: 0;">Automated message • Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

export function renderVerificationEmail(props: VerificationEmailProps): { html: string; text: string } {
  const greeting = props.name ? `Hi ${props.name},` : 'Hello,';
  const expires = props.expiresInMinutes || 10;

  const html = wrapInLayout(
    'Verify your GhumneChalo Email',
    `<h1 class="h1">Verify your email address</h1>
    <p class="text">${greeting}</p>
    <p class="text">Welcome to GhumneChalo! Please confirm your email address by entering the following 6-digit verification code:</p>
    <div class="otp-box">
      <div class="otp-code">${props.otp}</div>
    </div>
    <p class="text" style="font-size: 13px; color: #64748b;">
      ⏱️ This verification code is valid for <strong>${expires} minutes</strong>.
    </p>
    <div class="alert-box">
      <p class="alert-text">If you did not create a GhumneChalo account, you can safely disregard this email.</p>
    </div>`
  );

  const text = `${greeting}\n\nYour GhumneChalo verification code is: ${props.otp}\n\nThis code will expire in ${expires} minutes.\nIf you did not request this, please ignore this email.`;

  return { html, text };
}

export function renderTwoFactorEmail(props: TwoFactorEmailProps): { html: string; text: string } {
  const greeting = props.name ? `Hi ${props.name},` : 'Hello,';
  const expires = props.expiresInMinutes || 5;
  const context = props.isSetup ? 'enabling Two-Step Verification' : 'signing in to your account';

  const html = wrapInLayout(
    'Your Two-Step Verification Code',
    `<h1 class="h1">Two-Step Verification Code</h1>
    <p class="text">${greeting}</p>
    <p class="text">You are ${context} on GhumneChalo. Please enter the verification code below to proceed:</p>
    <div class="otp-box" style="background: #eff6ff; border-color: #bfdbfe;">
      <div class="otp-code" style="color: #1e40af;">${props.otp}</div>
    </div>
    <p class="text" style="font-size: 13px; color: #64748b;">
      ⏱️ This code will expire in <strong>${expires} minutes</strong>.
    </p>
    <div class="alert-box">
      <p class="alert-text"><strong>Security Alert:</strong> Never share this code with anyone. GhumneChalo representatives will never ask for your verification code.</p>
    </div>`
  );

  const text = `${greeting}\n\nYour GhumneChalo 2-step verification code is: ${props.otp}\n\nValid for ${expires} minutes. Never share this code with anyone.`;

  return { html, text };
}

export function renderPasswordResetEmail(props: PasswordResetEmailProps): { html: string; text: string } {
  const greeting = props.name ? `Hi ${props.name},` : 'Hello,';
  const expires = props.expiresInMinutes || 60;

  const html = wrapInLayout(
    'Reset your GhumneChalo Password',
    `<h1 class="h1">Password Reset Request</h1>
    <p class="text">${greeting}</p>
    <p class="text">We received a request to reset the password for your GhumneChalo account. Click the button below to choose a new password:</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${props.resetUrl}" class="btn">Reset My Password</a>
    </div>
    <p class="text" style="font-size: 13px; color: #64748b;">
      ⏱️ This link is single-use and will expire in <strong>${expires} minutes</strong>.
    </p>
    <p class="text" style="font-size: 12px; color: #94a3b8; word-break: break-all;">
      Or copy and paste this link into your browser:<br>
      <a href="${props.resetUrl}" style="color: #64748b;">${props.resetUrl}</a>
    </p>
    <div class="alert-box">
      <p class="alert-text">If you did not request a password reset, your password will remain unchanged and you can safely ignore this email.</p>
    </div>`
  );

  const text = `${greeting}\n\nReset your GhumneChalo password using the link below:\n${props.resetUrl}\n\nThis link expires in ${expires} minutes.\nIf you did not request this, please ignore this email.`;

  return { html, text };
}

export function renderSecurityAlertEmail(props: SecurityAlertEmailProps): { html: string; text: string } {
  const greeting = props.name ? `Hi ${props.name},` : 'Hello,';
  const time = props.timestamp || new Date().toUTCString();

  const html = wrapInLayout(
    'GhumneChalo Security Notice',
    `<h1 class="h1">Security Alert</h1>
    <p class="text">${greeting}</p>
    <p class="text">Important security update regarding your GhumneChalo account:</p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-weight: 700; color: #0f172a; font-size: 14px;">${props.eventName}</p>
      <p style="margin: 0 0 6px; color: #475569; font-size: 13px;">${props.details}</p>
      <p style="margin: 0; color: #94a3b8; font-size: 11px;">Timestamp: ${time}</p>
    </div>
    <div class="alert-box">
      <p class="alert-text">If you performed this action, no further steps are needed. If you did <strong>not</strong> authorize this change, please sign in and change your password immediately.</p>
    </div>`
  );

  const text = `${greeting}\n\nSecurity Alert: ${props.eventName}\n${props.details}\nTimestamp: ${time}\n\nIf you did not perform this action, please reset your password immediately.`;

  return { html, text };
}
