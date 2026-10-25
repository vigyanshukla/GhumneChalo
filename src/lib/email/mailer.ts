import nodemailer, { Transporter } from 'nodemailer';
import {
  renderVerificationEmail,
  renderTwoFactorEmail,
  renderPasswordResetEmail,
  renderSecurityAlertEmail,
} from './templates';

export interface SentEmailRecord {
  to: string;
  subject: string;
  html: string;
  text?: string;
  type: 'VERIFICATION' | '2FA' | 'PASSWORD_RESET' | 'SECURITY_ALERT';
  timestamp: Date;
}

// In-memory queue for automated test inspection and offline validation
const mockSentEmails: SentEmailRecord[] = [];

let cachedTransporter: Transporter | null = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || (process.env.GMAIL ? 'smtp.gmail.com' : undefined);
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || process.env.GMAIL;
  const rawPass = process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  const pass = rawPass?.replace(/\s+/g, '');
  const from =
    process.env.SMTP_FROM ||
    (user ? `"GhumneChalo" <${user}>` : '"GhumneChalo" <no-reply@ghumnechalo.com>');

  const isConfigured = Boolean(host && user && pass);

  return { host, port, user, pass, from, isConfigured };
}

/**
 * Returns a configured nodemailer Transporter or null if unconfigured/test mode.
 */
function getTransporter(): Transporter | null {
  // In automated test environments, strictly use the in-memory mock to avoid external network calls
  if (process.env.VITEST) {
    return null;
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  const { host, port, user, pass, isConfigured } = getSmtpConfig();

  if (!isConfigured) {
    return null;
  }

  try {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
    return cachedTransporter;
  } catch (err) {
    console.error('[NodeMailer Init Error]:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Generic email dispatcher with graceful fallback to mock recorder.
 */
async function dispatchEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  type: SentEmailRecord['type'];
}): Promise<{ success: boolean; messageId?: string }> {
  const { from } = getSmtpConfig();

  // Always record sent email for test assertions and diagnostics
  mockSentEmails.push({
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    type: params.type,
    timestamp: new Date(),
  });

  const transporter = getTransporter();

  if (!transporter) {
    // Development / Test mode logging (without leaking secrets)
    console.log(`[Email Dispatched (Test/Dev Mode)] Type: ${params.type} -> To: ${params.to}`);
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    console.log(`[Email Sent via SMTP] Type: ${params.type} -> ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch {
    console.error(`[SMTP Send Error] Type: ${params.type} -> Recipient: ${params.to}`);
    // Return safe failure without crashing calling process
    return { success: false };
  }
}

/**
 * Sends a 6-digit email verification OTP.
 */
export async function sendVerificationEmail(params: {
  email: string;
  name?: string | null;
  otp: string;
  expiresInMinutes?: number;
}): Promise<{ success: boolean }> {
  const { html, text } = renderVerificationEmail({
    name: params.name,
    otp: params.otp,
    expiresInMinutes: params.expiresInMinutes || 10,
  });

  return dispatchEmail({
    to: params.email,
    subject: 'Verify your GhumneChalo email address',
    html,
    text,
    type: 'VERIFICATION',
  });
}

/**
 * Sends a 6-digit Two-Step Verification (2FA) OTP.
 */
export async function sendLoginOtpEmail(params: {
  email: string;
  name?: string | null;
  otp: string;
  expiresInMinutes?: number;
  isSetup?: boolean;
}): Promise<{ success: boolean }> {
  const { html, text } = renderTwoFactorEmail({
    name: params.name,
    otp: params.otp,
    expiresInMinutes: params.expiresInMinutes || 5,
    isSetup: params.isSetup,
  });

  return dispatchEmail({
    to: params.email,
    subject: params.isSetup
      ? 'Confirm Two-Step Verification Setup'
      : 'Your GhumneChalo Two-Step Verification Code',
    html,
    text,
    type: '2FA',
  });
}

/**
 * Sends a Password Reset email with secure reset link.
 */
export async function sendPasswordResetEmail(params: {
  email: string;
  name?: string | null;
  resetUrl: string;
  expiresInMinutes?: number;
}): Promise<{ success: boolean }> {
  const { html, text } = renderPasswordResetEmail({
    name: params.name,
    resetUrl: params.resetUrl,
    expiresInMinutes: params.expiresInMinutes || 60,
  });

  return dispatchEmail({
    to: params.email,
    subject: 'Reset your GhumneChalo password',
    html,
    text,
    type: 'PASSWORD_RESET',
  });
}

/**
 * Sends an account security alert notification.
 */
export async function sendSecurityAlertEmail(params: {
  email: string;
  name?: string | null;
  eventName: string;
  details: string;
}): Promise<{ success: boolean }> {
  const { html, text } = renderSecurityAlertEmail({
    name: params.name,
    eventName: params.eventName,
    details: params.details,
  });

  return dispatchEmail({
    to: params.email,
    subject: `Security Alert: ${params.eventName}`,
    html,
    text,
    type: 'SECURITY_ALERT',
  });
}

// =========================================================================
// TEST SUITE INSPECTION HELPERS
// =========================================================================

export function getSentEmails(): SentEmailRecord[] {
  return [...mockSentEmails];
}

export function getLastSentEmail(): SentEmailRecord | undefined {
  return mockSentEmails[mockSentEmails.length - 1];
}

export function clearSentEmails(): void {
  mockSentEmails.length = 0;
}
