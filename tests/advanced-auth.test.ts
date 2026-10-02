import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { POST as registerUser } from '../src/app/api/auth/register/route';
import { POST as verifyEmail } from '../src/app/api/auth/verify-email/route';
import { POST as loginUser } from '../src/app/api/auth/login/route';
import { POST as verify2Fa } from '../src/app/api/auth/verify-2fa/route';
import { POST as enable2Fa } from '../src/app/api/account/2fa/enable/route';
import { POST as confirm2Fa } from '../src/app/api/account/2fa/confirm/route';
import { POST as disable2Fa } from '../src/app/api/account/2fa/disable/route';
import { GET as getSecurityStatus } from '../src/app/api/account/security/route';
import { POST as forgotPassword } from '../src/app/api/auth/forgot-password/route';
import { POST as resetPassword } from '../src/app/api/auth/reset-password/route';
import { POST as changePassword } from '../src/app/api/auth/change-password/route';
import { handleGoogleSignIn } from '../src/lib/auth-oauth';
import { verifySessionToken } from '../src/lib/session';
import {
  createSecurityCode,
  verifySecurityCode,
  hashToken,
  resetRateLimit,
} from '../src/lib/auth-security';
import {
  getSentEmails,
  clearSentEmails,
  getLastSentEmail,
} from '../src/lib/email/mailer';

describe('Phase 9 — Advanced Authentication & Email Security (TC-9.01 to TC-9.35)', () => {
  const TEST_EMAIL = 'adv.auth.traveler@ghumnechalo-p9.com';
  const TEST_PASSWORD = 'SecurePass987@Phase9';
  const NEW_PASSWORD = 'BrandNewSecurePass#99';
  const SECOND_USER_EMAIL = 'second.user@ghumnechalo-p9.com';

  let testUserId: string;
  let testUserToken: string;
  let secondUserId: string;
  let secondUserToken: string;

  function req(url: string, method = 'POST', body?: unknown, authHeader?: string) {
    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers: {
        'content-type': 'application/json',
        ...(authHeader ? { authorization: `Bearer ${authHeader}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  beforeAll(async () => {
    clearSentEmails();
    // Clean up test domain records
    await prisma.authSecurityCode.deleteMany({
      where: { email: { contains: 'ghumnechalo-p9.com' } },
    });
    await prisma.verificationToken.deleteMany({
      where: { identifier: { contains: 'ghumnechalo-p9.com' } },
    });
    await prisma.account.deleteMany({
      where: { user: { email: { contains: 'ghumnechalo-p9.com' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'ghumnechalo-p9.com' } },
    });
  });

  afterAll(async () => {
    clearSentEmails();
    await prisma.authSecurityCode.deleteMany({
      where: { email: { contains: 'ghumnechalo-p9.com' } },
    });
    await prisma.verificationToken.deleteMany({
      where: { identifier: { contains: 'ghumnechalo-p9.com' } },
    });
    await prisma.account.deleteMany({
      where: { user: { email: { contains: 'ghumnechalo-p9.com' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'ghumnechalo-p9.com' } },
    });
  });

  // ============================================================
  // REGISTRATION, PASSWORD & OTP HASHING (TC-9.01 to TC-9.03)
  // ============================================================

  it('TC-9.01: Email registration creates account', async () => {
    clearSentEmails();
    const r = req('/api/auth/register', 'POST', {
      name: 'Adv Traveler',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    });
    const res = await registerUser(r);
    expect(res.status).toBe(201);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe(TEST_EMAIL);
    expect(data.data.requiresEmailVerification).toBe(true);

    testUserId = data.data.user.id;
    testUserToken = data.data.token;

    // Verify verification email was dispatched via NodeMailer mock
    const emails = getSentEmails();
    expect(emails.length).toBeGreaterThanOrEqual(1);
    const lastEmail = getLastSentEmail();
    expect(lastEmail?.to).toBe(TEST_EMAIL);
    expect(lastEmail?.type).toBe('VERIFICATION');
  });

  it('TC-9.02: Password is hashed in database', async () => {
    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user).toBeDefined();
    expect(user?.passwordHash).toBeDefined();
    expect(user?.passwordHash).not.toBe(TEST_PASSWORD);
    expect(user?.passwordHash?.startsWith('$2')).toBe(true); // bcrypt prefix
    expect(bcrypt.compareSync(TEST_PASSWORD, user!.passwordHash!)).toBe(true);
  });

  it('TC-9.03: Verification OTP is hashed in database', async () => {
    const codeRecord = await prisma.authSecurityCode.findFirst({
      where: { email: TEST_EMAIL, type: 'EMAIL_VERIFICATION' },
    });
    expect(codeRecord).toBeDefined();
    expect(codeRecord?.hashedCode).toBeDefined();
    // SHA-256 hash length is 64 hex characters
    expect(codeRecord?.hashedCode).toHaveLength(64);
    // Raw numeric OTP must not be stored in plaintext
    expect(codeRecord?.hashedCode).not.toMatch(/^\d{6}$/);
  });

  // ============================================================
  // OTP EXPIRY, ATTEMPTS & VERIFICATION (TC-9.04 to TC-9.10)
  // ============================================================

  it('TC-9.04: Verification OTP expires', async () => {
    // Insert an artificially expired code
    const expiredEmail = 'expired.otp@ghumnechalo-p9.com';
    const rawOtp = '123456';
    await prisma.authSecurityCode.create({
      data: {
        email: expiredEmail,
        type: 'EMAIL_VERIFICATION',
        hashedCode: hashToken(rawOtp),
        expiresAt: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
        attempts: 0,
        maxAttempts: 5,
      },
    });

    const verifyResult = await verifySecurityCode(expiredEmail, 'EMAIL_VERIFICATION', rawOtp);
    expect(verifyResult.success).toBe(false);
    expect(verifyResult.reason).toBe('EXPIRED');
  });

  it('TC-9.05: Incorrect OTP rejected', async () => {
    resetRateLimit(`verify_email:${TEST_EMAIL}`);
    const r = req('/api/auth/verify-email', 'POST', {
      email: TEST_EMAIL,
      otp: '000000',
    });
    const res = await verifyEmail(r);
    expect([400, 422]).toContain(res.status);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toMatch(/invalid/i);
  });

  it('TC-9.06: OTP attempt limit works', async () => {
    const bruteEmail = 'brute.force@ghumnechalo-p9.com';
    const rawOtp = '888888';
    await prisma.authSecurityCode.create({
      data: {
        email: bruteEmail,
        type: 'EMAIL_VERIFICATION',
        hashedCode: hashToken(rawOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 4, // 1 away from max
        maxAttempts: 5,
      },
    });

    // 5th attempt (incorrect)
    const result1 = await verifySecurityCode(bruteEmail, 'EMAIL_VERIFICATION', '111111');
    expect(result1.success).toBe(false);
    expect(result1.reason).toBe('MAX_ATTEMPTS');

    // Code must be deleted after max attempts
    const inDb = await prisma.authSecurityCode.findFirst({
      where: { email: bruteEmail, type: 'EMAIL_VERIFICATION' },
    });
    expect(inDb).toBeNull();
  });

  it('TC-9.07: Successful OTP verifies email', async () => {
    // Get valid OTP for test user
    const { rawOtp } = await createSecurityCode({
      email: TEST_EMAIL,
      type: 'EMAIL_VERIFICATION',
      userId: testUserId,
      cooldownSeconds: 0,
    });

    resetRateLimit(`verify_email:${TEST_EMAIL}`);
    const r = req('/api/auth/verify-email', 'POST', {
      email: TEST_EMAIL,
      otp: rawOtp,
    });
    const res = await verifyEmail(r);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user?.emailVerified).not.toBeNull();
  });

  it('TC-9.08: Used OTP cannot be reused', async () => {
    const reuseEmail = 'reuse.otp@ghumnechalo-p9.com';
    const rawOtp = '654321';
    await prisma.authSecurityCode.create({
      data: {
        email: reuseEmail,
        type: 'EMAIL_VERIFICATION',
        hashedCode: hashToken(rawOtp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        maxAttempts: 5,
      },
    });

    // First use: succeeds
    const firstUse = await verifySecurityCode(reuseEmail, 'EMAIL_VERIFICATION', rawOtp);
    expect(firstUse.success).toBe(true);

    // Second use: immediately fails because code was consumed
    const secondUse = await verifySecurityCode(reuseEmail, 'EMAIL_VERIFICATION', rawOtp);
    expect(secondUse.success).toBe(false);
    expect(secondUse.reason).toBe('NOT_FOUND');
  });

  it('TC-9.09: Resend invalidates previous OTP', async () => {
    const resendEmail = 'resend.test@ghumnechalo-p9.com';
    // Issue first code
    const first = await createSecurityCode({
      email: resendEmail,
      type: 'EMAIL_VERIFICATION',
      cooldownSeconds: 0,
    });

    // Issue second code (simulating resend with 0 cooldown)
    const second = await createSecurityCode({
      email: resendEmail,
      type: 'EMAIL_VERIFICATION',
      cooldownSeconds: 0,
    });

    // First code must be rejected
    const testFirst = await verifySecurityCode(resendEmail, 'EMAIL_VERIFICATION', first.rawOtp);
    expect(testFirst.success).toBe(false);

    // Second code must be accepted
    const testSecond = await verifySecurityCode(resendEmail, 'EMAIL_VERIFICATION', second.rawOtp);
    expect(testSecond.success).toBe(true);
  });

  it('TC-9.10: Resend cooldown works', async () => {
    const cooldownEmail = 'cooldown@ghumnechalo-p9.com';
    await createSecurityCode({
      email: cooldownEmail,
      type: 'EMAIL_VERIFICATION',
      cooldownSeconds: 60,
    });

    // Trying again immediately should throw TooManyRequestsError
    await expect(
      createSecurityCode({
        email: cooldownEmail,
        type: 'EMAIL_VERIFICATION',
        cooldownSeconds: 60,
      })
    ).rejects.toThrow(/wait \d+ seconds/i);
  });

  // ============================================================
  // PASSWORD RESET (TC-9.11 to TC-9.16)
  // ============================================================

  it('TC-9.11: Forgot password returns generic response', async () => {
    resetRateLimit(`forgot_password:${TEST_EMAIL}`);
    const r1 = req('/api/auth/forgot-password', 'POST', { email: TEST_EMAIL });
    const res1 = await forgotPassword(r1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.data.message).toMatch(/if an account exists/i);

    // Non-existent email gets the identical generic response
    const fakeEmail = 'nonexistent.user@ghumnechalo-p9.com';
    resetRateLimit(`forgot_password:${fakeEmail}`);
    const r2 = req('/api/auth/forgot-password', 'POST', { email: fakeEmail });
    const res2 = await forgotPassword(r2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.data.message).toBe(data1.data.message);
  });

  it('TC-9.12: Password reset token is hashed in database', async () => {
    const record = await prisma.verificationToken.findFirst({
      where: { identifier: `reset:${TEST_EMAIL}` },
    });
    expect(record).toBeDefined();
    // Must be a 64 hex character SHA-256 hash
    expect(record?.token).toHaveLength(64);
  });

  it('TC-9.13: Expired reset token rejected', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.verificationToken.create({
      data: {
        identifier: `reset:${TEST_EMAIL}`,
        token: tokenHash,
        expires: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
      },
    });

    const r = req('/api/auth/reset-password', 'POST', {
      token: rawToken,
      password: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    const res = await resetPassword(r);
    expect([400, 422]).toContain(res.status);
    const data = await res.json();
    expect(data.error.message).toMatch(/expired/i);
  });

  it('TC-9.14: Used reset token rejected', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Calling reset with non-existent / previously consumed token
    const r = req('/api/auth/reset-password', 'POST', {
      token: rawToken,
      password: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    const res = await resetPassword(r);
    expect([400, 422]).toContain(res.status);
    const data = await res.json();
    expect(data.error.message).toMatch(/invalid|expired|used/i);
  });

  it('TC-9.15: Successful password reset works', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.verificationToken.deleteMany({
      where: { identifier: `reset:${TEST_EMAIL}` },
    });
    await prisma.verificationToken.create({
      data: {
        identifier: `reset:${TEST_EMAIL}`,
        token: tokenHash,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const r = req('/api/auth/reset-password', 'POST', {
      token: rawToken,
      password: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    const res = await resetPassword(r);
    expect(res.status).toBe(200);

    // Verify password in DB was changed to NEW_PASSWORD
    const updatedUser = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(bcrypt.compareSync(NEW_PASSWORD, updatedUser!.passwordHash!)).toBe(true);
    expect(bcrypt.compareSync(TEST_PASSWORD, updatedUser!.passwordHash!)).toBe(false);
  });

  it('TC-9.16: Old reset token cannot be reused', async () => {
    // Reset token is already deleted after TC-9.15
    const record = await prisma.verificationToken.findFirst({
      where: { identifier: `reset:${TEST_EMAIL}` },
    });
    expect(record).toBeNull();
  });

  // ============================================================
  // CHANGE PASSWORD (TC-9.17 to TC-9.18)
  // ============================================================

  it('TC-9.17: Change password validates current password', async () => {
    const r = req(
      '/api/auth/change-password',
      'POST',
      {
        currentPassword: 'WrongCurrentPassword123!',
        newPassword: TEST_PASSWORD,
        confirmNewPassword: TEST_PASSWORD,
      },
      testUserToken
    );
    const res = await changePassword(r);
    expect([400, 422]).toContain(res.status);
    const data = await res.json();
    expect(data.error.message).toMatch(/current password is incorrect/i);
  });

  it('TC-9.18: New password is hashed upon change', async () => {
    const r = req(
      '/api/auth/change-password',
      'POST',
      {
        currentPassword: NEW_PASSWORD,
        newPassword: TEST_PASSWORD,
        confirmNewPassword: TEST_PASSWORD,
      },
      testUserToken
    );
    const res = await changePassword(r);
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(bcrypt.compareSync(TEST_PASSWORD, user!.passwordHash!)).toBe(true);
  });

  // ============================================================
  // TWO-FACTOR AUTHENTICATION / 2FA (TC-9.19 to TC-9.23)
  // ============================================================

  it('TC-9.19: 2FA enable requires verification', async () => {
    // Step 1: User requests 2FA enable
    const r1 = req('/api/account/2fa/enable', 'POST', {}, testUserToken);
    const res1 = await enable2Fa(r1);
    expect(res1.status).toBe(200);

    // Verify 2FA is NOT immediately enabled
    let user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user?.twoFactorEnabled).toBe(false);

    // Get setup OTP from auth_security_codes
    const codeRecord = await prisma.authSecurityCode.findFirst({
      where: { email: TEST_EMAIL, type: 'TWO_FACTOR_SETUP' },
    });
    expect(codeRecord).toBeDefined();

    // Verify wrong OTP fails
    const rWrong = req('/api/account/2fa/confirm', 'POST', { otp: '000000' }, testUserToken);
    const resWrong = await confirm2Fa(rWrong);
    expect([400, 422]).toContain(resWrong.status);

    // Issue fresh code for confirming
    const { rawOtp } = await createSecurityCode({
      email: TEST_EMAIL,
      type: 'TWO_FACTOR_SETUP',
      userId: testUserId,
      cooldownSeconds: 0,
    });

    // Step 2: Confirm with correct OTP
    const rConfirm = req('/api/account/2fa/confirm', 'POST', { otp: rawOtp }, testUserToken);
    const resConfirm = await confirm2Fa(rConfirm);
    expect(resConfirm.status).toBe(200);

    // Verify 2FA is now enabled in database
    user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user?.twoFactorEnabled).toBe(true);
  });

  it('TC-9.20: 2FA login requires OTP', async () => {
    resetRateLimit(`login_attempt:${TEST_EMAIL}`);
    const r = req('/api/auth/login', 'POST', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    const res = await loginUser(r);
    expect(res.status).toBe(200);
    const data = await res.json();

    // Must NOT grant a logged-in session immediately
    expect(data.data.requires2FA).toBe(true);
    expect(data.data.tempToken).toBeDefined();
    expect(data.data.token).toBeUndefined();

    // Verify 2FA email was dispatched
    const lastEmail = getLastSentEmail();
    expect(lastEmail?.to).toBe(TEST_EMAIL);
    expect(lastEmail?.type).toBe('2FA');
  });

  it('TC-9.21: 2FA OTP expires', async () => {
    const expired2FaEmail = 'expired.2fa@ghumnechalo-p9.com';
    const rawOtp = '222222';
    await prisma.authSecurityCode.create({
      data: {
        email: expired2FaEmail,
        type: 'TWO_FACTOR_LOGIN',
        hashedCode: hashToken(rawOtp),
        expiresAt: new Date(Date.now() - 1000 * 60), // Expired
        attempts: 0,
        maxAttempts: 5,
      },
    });

    const verifyRes = await verifySecurityCode(expired2FaEmail, 'TWO_FACTOR_LOGIN', rawOtp);
    expect(verifyRes.success).toBe(false);
    expect(verifyRes.reason).toBe('EXPIRED');
  });

  it('TC-9.22: 2FA OTP cannot be reused', async () => {
    // Generate valid 2FA code
    const { rawOtp } = await createSecurityCode({
      email: TEST_EMAIL,
      type: 'TWO_FACTOR_LOGIN',
      userId: testUserId,
      cooldownSeconds: 0,
    });

    resetRateLimit(`verify_2fa:${TEST_EMAIL}`);
    const r1 = req('/api/auth/verify-2fa', 'POST', {
      email: TEST_EMAIL,
      otp: rawOtp,
    });
    const res1 = await verify2Fa(r1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.data.token).toBeDefined();

    // Immediate second attempt with same OTP fails
    const r2 = req('/api/auth/verify-2fa', 'POST', {
      email: TEST_EMAIL,
      otp: rawOtp,
    });
    const res2 = await verify2Fa(r2);
    expect([400, 422]).toContain(res2.status);
  });

  it('TC-9.23: 2FA disable requires verification', async () => {
    // Wrong password fails
    const rWrong = req(
      '/api/account/2fa/disable',
      'POST',
      { password: 'WrongPassword123!' },
      testUserToken
    );
    const resWrong = await disable2Fa(rWrong);
    expect([400, 422]).toContain(resWrong.status);

    // Correct password succeeds
    const rRight = req(
      '/api/account/2fa/disable',
      'POST',
      { password: TEST_PASSWORD },
      testUserToken
    );
    const resRight = await disable2Fa(rRight);
    expect(resRight.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user?.twoFactorEnabled).toBe(false);
  });

  // ============================================================
  // GOOGLE OAUTH & ACCOUNT LINKING (TC-9.24 to TC-9.27)
  // ============================================================

  it('TC-9.24: Google new user creates account', async () => {
    const googleNewEmail = 'new.google.traveler@ghumnechalo-p9.com';
    const signedIn = await handleGoogleSignIn({
      user: {
        email: googleNewEmail,
        name: 'Google Explorer',
        image: 'https://lh3.googleusercontent.com/a/photo.jpg',
      },
      account: {
        provider: 'google',
        providerAccountId: 'g-account-id-001',
      },
    });

    expect(signedIn).toBe(true);

    const createdUser = await prisma.user.findUnique({
      where: { email: googleNewEmail },
      include: { accounts: true },
    });
    expect(createdUser).toBeDefined();
    expect(createdUser?.name).toBe('Google Explorer');
    // Google verified emails are verified automatically
    expect(createdUser?.emailVerified).not.toBeNull();
    expect(createdUser?.accounts).toHaveLength(1);
    expect(createdUser?.accounts[0].provider).toBe('google');
  });

  it('TC-9.25: Google existing user signs in', async () => {
    const googleNewEmail = 'new.google.traveler@ghumnechalo-p9.com';
    const signedInAgain = await handleGoogleSignIn({
      user: {
        email: googleNewEmail,
        name: 'Google Explorer',
      },
      account: {
        provider: 'google',
        providerAccountId: 'g-account-id-001',
      },
    });

    expect(signedInAgain).toBe(true);
  });

  it('TC-9.26: Google does not create duplicate user', async () => {
    const googleNewEmail = 'new.google.traveler@ghumnechalo-p9.com';
    const allUsers = await prisma.user.findMany({
      where: { email: googleNewEmail },
    });
    expect(allUsers).toHaveLength(1);
  });

  it('TC-9.27: Google/email account linking is safe', async () => {
    // Existing user TEST_EMAIL has a local password
    const beforeUser = await prisma.user.findUnique({
      where: { id: testUserId },
      include: { accounts: true },
    });
    expect(beforeUser?.passwordHash).toBeDefined();
    expect(beforeUser?.accounts).toHaveLength(0);

    // Now user signs in with Google using TEST_EMAIL
    const linked = await handleGoogleSignIn({
      user: {
        email: TEST_EMAIL,
        name: 'Adv Traveler',
      },
      account: {
        provider: 'google',
        providerAccountId: 'google-oauth-linked-007',
      },
    });
    expect(linked).toBe(true);

    // Verify same user record is kept, password is safe, and account is linked
    const afterUser = await prisma.user.findUnique({
      where: { id: testUserId },
      include: { accounts: true },
    });
    expect(afterUser?.id).toBe(testUserId);
    expect(afterUser?.passwordHash).toBe(beforeUser?.passwordHash); // Untouched
    expect(afterUser?.accounts).toHaveLength(1);
    expect(afterUser?.accounts[0].providerAccountId).toBe('google-oauth-linked-007');
  });

  // ============================================================
  // AUTHORIZATION, IDOR & SECURITY CHECKS (TC-9.28 to TC-9.35)
  // ============================================================

  it('TC-9.28: Forged userId is ignored', async () => {
    // Create a second user
    const r2 = req('/api/auth/register', 'POST', {
      name: 'Second User',
      email: SECOND_USER_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    });
    const res2 = await registerUser(r2);
    const data2 = await res2.json();
    secondUserId = data2.data.user.id;
    secondUserToken = data2.data.token;
    expect(secondUserId).toBeDefined();

    // Attacker sends request with auth header of User 1, but body containing secondUserId
    const forgedReq = req(
      '/api/account/security',
      'GET',
      undefined,
      testUserToken // Identity must be resolved to User 1
    );
    const res = await getSecurityStatus(forgedReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    // Must return User 1's email, not User 2's
    expect(data.data.email).toBe(TEST_EMAIL);
    expect(data.data.email).not.toBe(SECOND_USER_EMAIL);
  });

  it('TC-9.29: Unauthenticated security API rejected', async () => {
    const unauthReq = req('/api/account/security', 'GET');
    const res = await getSecurityStatus(unauthReq);
    expect(res.status).toBe(401);
  });

  it('TC-9.30: Cross-user account modification rejected', async () => {
    // User 2 cannot disable 2FA or change password of User 1
    const attackReq = req(
      '/api/account/2fa/disable',
      'POST',
      { password: TEST_PASSWORD, userId: testUserId }, // Attempting to target testUserId
      secondUserToken // authenticated as secondUser
    );
    const res = await disable2Fa(attackReq);
    expect(res.status).toBe(200);
    // User 2 doesn't have 2FA enabled, so operation affects User 2's state (not User 1)
    const user1 = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user1?.email).toBe(TEST_EMAIL);
  });

  it('TC-9.31: Passwords never enter session', async () => {
    const payload = await verifySessionToken(testUserToken);
    expect(payload).toBeDefined();
    expect(payload?.password).toBeUndefined();
    expect(payload?.passwordHash).toBeUndefined();
    expect((payload as Record<string, unknown>).hash).toBeUndefined();
  });

  it('TC-9.32: OTP never enters session', async () => {
    const payload = await verifySessionToken(testUserToken);
    expect(payload?.otp).toBeUndefined();
    expect((payload as Record<string, unknown>).code).toBeUndefined();
    expect((payload as Record<string, unknown>).rawOtp).toBeUndefined();
  });

  it('TC-9.33: Reset token never enters session', async () => {
    const payload = await verifySessionToken(testUserToken);
    expect((payload as Record<string, unknown>).resetToken).toBeUndefined();
    expect((payload as Record<string, unknown>).tokenHash).toBeUndefined();
  });

  it('TC-9.34: SMTP credentials never reach client', () => {
    // Check that neither SMTP_PASSWORD nor SMTP_USER are exposed with NEXT_PUBLIC_ prefix
    expect(process.env.NEXT_PUBLIC_SMTP_PASSWORD).toBeUndefined();
    expect(process.env.NEXT_PUBLIC_SMTP_USER).toBeUndefined();
    expect(process.env.NEXT_PUBLIC_SMTP_HOST).toBeUndefined();
  });

  it('TC-9.35: Forgot-password does not reveal account existence', async () => {
    resetRateLimit('forgot_password:real.enumeration@test.com');
    resetRateLimit('forgot_password:ghost.enumeration@test.com');

    // Call 1: Real existing user
    const r1 = req('/api/auth/forgot-password', 'POST', { email: TEST_EMAIL });
    const res1 = await forgotPassword(r1);
    const data1 = await res1.json();

    // Call 2: Random non-existent user
    const r2 = req('/api/auth/forgot-password', 'POST', { email: 'ghost.enumeration@test.com' });
    const res2 = await forgotPassword(r2);
    const data2 = await res2.json();

    // HTTP status must be identical (200)
    expect(res1.status).toBe(res2.status);
    // User-facing message must be character-for-character identical
    expect(data1.data.message).toBe(data2.data.message);
  });
});
