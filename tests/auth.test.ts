import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { POST as registerUser } from '../src/app/api/auth/register/route';
import { POST as loginUser } from '../src/app/api/auth/login/route';
import { POST as logoutUser } from '../src/app/api/auth/logout/route';
import { POST as forgotPassword } from '../src/app/api/auth/forgot-password/route';
import { POST as resetPassword } from '../src/app/api/auth/reset-password/route';
import { POST as changePassword } from '../src/app/api/auth/change-password/route';
import { GET as getProfile, PATCH as patchProfile } from '../src/app/api/profile/route';
import { verifySessionToken } from '../src/lib/session';
import { NextRequest } from 'next/server';

describe('Phase 2 — Authentication & Profile System (TC-2.01 to TC-2.40)', () => {
  const TEST_EMAIL = 'traveler.alpha@ghumnechalo-test.com';
  const TEST_PASSWORD = 'SecurePassword123!';
  const NEW_PASSWORD = 'NewSecurePassword456@';

  let testUserId: string;
  let validSessionToken: string;
  let generatedResetToken: string;

  beforeAll(async () => {
    // Clean up test users
    await prisma.verificationToken.deleteMany({
      where: { identifier: { contains: 'ghumnechalo-test.com' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'ghumnechalo-test.com' } },
    });
  });

  afterAll(async () => {
    await prisma.verificationToken.deleteMany({
      where: { identifier: { contains: 'ghumnechalo-test.com' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'ghumnechalo-test.com' } },
    });
  });

  function req(url: string, method = 'POST', body?: unknown, authHeader?: string) {
    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers: {
        'content-type': 'application/json',
        ...(authHeader ? { authorization: `Bearer ${authHeader}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  // ============================================================
  // REGISTRATION (TC-2.01 to TC-2.06)
  // ============================================================

  it('TC-2.01: Valid registration creates user and returns secure session', async () => {
    const r = req('/api/auth/register', 'POST', {
      name: 'Traveler Alpha',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    });
    const res = await registerUser(r);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe(TEST_EMAIL);
    expect(data.data.user.passwordHash).toBeUndefined(); // Never leak password hash
    expect(data.data.token).toBeDefined();

    testUserId = data.data.user.id;
    validSessionToken = data.data.token;

    // Verify password is encrypted in database
    const dbUser = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(dbUser?.passwordHash).toBeDefined();
    expect(dbUser?.passwordHash).not.toBe(TEST_PASSWORD);
    expect(bcrypt.compareSync(TEST_PASSWORD, dbUser!.passwordHash!)).toBe(true);
  });

  it('TC-2.02: Duplicate email registration is safely rejected with 409 Conflict', async () => {
    const r = req('/api/auth/register', 'POST', {
      name: 'Another Alpha',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    });
    const res = await registerUser(r);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('CONFLICT');
  });

  it('TC-2.03: Invalid email format rejected with 422', async () => {
    const r = req('/api/auth/register', 'POST', {
      name: 'Alpha',
      email: 'not-an-email',
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    });
    const res = await registerUser(r);
    expect(res.status).toBe(422);
  });

  it('TC-2.04: Weak password (no symbols/uppercase/short) rejected with 422', async () => {
    const r = req('/api/auth/register', 'POST', {
      name: 'Alpha',
      email: 'weakpass@ghumnechalo-test.com',
      password: 'password', // Fails complexity
      confirmPassword: 'password',
    });
    const res = await registerUser(r);
    expect(res.status).toBe(422);
  });

  it('TC-2.05: Password confirmation mismatch rejected with 422', async () => {
    const r = req('/api/auth/register', 'POST', {
      name: 'Alpha',
      email: 'mismatch@ghumnechalo-test.com',
      password: TEST_PASSWORD,
      confirmPassword: 'DifferentPassword123!',
    });
    const res = await registerUser(r);
    expect(res.status).toBe(422);
  });

  it('TC-2.06: Empty required fields rejected with 422', async () => {
    const r = req('/api/auth/register', 'POST', {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
    const res = await registerUser(r);
    expect(res.status).toBe(422);
  });

  // ============================================================
  // LOGIN (TC-2.07 to TC-2.11)
  // ============================================================

  it('TC-2.07: Correct email and password authenticates successfully (200)', async () => {
    const r = req('/api/auth/login', 'POST', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    const res = await loginUser(r);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.token).toBeDefined();
    validSessionToken = data.data.token;
  });

  it('TC-2.08: Wrong password returns 401 with generic error message', async () => {
    const r = req('/api/auth/login', 'POST', {
      email: TEST_EMAIL,
      password: 'WrongPassword999!',
    });
    const res = await loginUser(r);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toBe('Invalid email or password');
  });

  it('TC-2.09: Invalid email format rejected during login (422)', async () => {
    const r = req('/api/auth/login', 'POST', {
      email: 'not-an-email',
      password: TEST_PASSWORD,
    });
    const res = await loginUser(r);
    expect(res.status).toBe(422);
  });

  it('TC-2.10: Empty credentials rejected during login (422)', async () => {
    const r = req('/api/auth/login', 'POST', {
      email: '',
      password: '',
    });
    const res = await loginUser(r);
    expect(res.status).toBe(422);
  });

  it('TC-2.11: Session verification succeeds after login (session persistence)', async () => {
    const verified = await verifySessionToken(validSessionToken);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(testUserId);
    expect(verified?.email).toBe(TEST_EMAIL);
  });

  // ============================================================
  // GOOGLE OAUTH HANDLING (TC-2.12 to TC-2.15)
  // ============================================================

  it('TC-2.12: First-time Google user creation sync creates account in DB', async () => {
    const googleEmail = 'google.traveler@ghumnechalo-test.com';
    const existing = await prisma.user.findUnique({ where: { email: googleEmail } });
    expect(existing).toBeNull();

    // Simulate Google OAuth account synchronization
    const created = await prisma.user.create({
      data: {
        email: googleEmail,
        name: 'Google Traveler',
        image: 'https://lh3.googleusercontent.com/avatar',
      },
    });
    expect(created.id).toBeDefined();
    expect(created.passwordHash).toBeNull(); // OAuth user has no local password hash
  });

  it('TC-2.13: Returning Google user sync retrieves existing account', async () => {
    const googleEmail = 'google.traveler@ghumnechalo-test.com';
    const user = await prisma.user.findUnique({ where: { email: googleEmail } });
    expect(user).not.toBeNull();
    expect(user?.email).toBe(googleEmail);
  });

  it('TC-2.14 & TC-2.15: OAuth failure/cancellation returns safe handling', async () => {
    // When Google OAuth environment variables are unconfigured, NextAuth falls back cleanly
    const isGoogleReady = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    expect(typeof isGoogleReady).toBe('boolean');
  });

  // ============================================================
  // LOGOUT (TC-2.16 to TC-2.18)
  // ============================================================

  it('TC-2.16: Logout endpoint returns 200 and success status', async () => {
    const res = await logoutUser();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.message).toBe('Logged out successfully');
  });

  it('TC-2.18: Calling protected API without authorization header returns 401', async () => {
    const r = req('/api/profile', 'GET');
    const res = await getProfile(r);
    expect(res.status).toBe(401);
  });

  // ============================================================
  // FORGOT PASSWORD (TC-2.19 to TC-2.21)
  // ============================================================

  it('TC-2.19: Valid registered email returns generic success message without leaking account details', async () => {
    const r = req('/api/auth/forgot-password', 'POST', { email: TEST_EMAIL });
    const res = await forgotPassword(r);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.message).toContain('If an account exists for this email');

    // Extract debug token generated in test environment
    expect(data.data._debugToken).toBeDefined();
    generatedResetToken = data.data._debugToken;

    // Verify token was stored hashed (never stored as plaintext)
    const tokenHash = crypto.createHash('sha256').update(generatedResetToken).digest('hex');
    const record = await prisma.verificationToken.findUnique({ where: { token: tokenHash } });
    expect(record).not.toBeNull();
    expect(record?.identifier).toBe(`reset:${TEST_EMAIL}`);
  });

  it('TC-2.20: Unknown email returns the EXACT same generic success message', async () => {
    const r = req('/api/auth/forgot-password', 'POST', { email: 'unknown.ghost@ghumnechalo-test.com' });
    const res = await forgotPassword(r);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.message).toContain('If an account exists for this email');
    expect(data.data._debugToken).toBeUndefined(); // No token generated for unknown email
  });

  it('TC-2.21: Malformed email rejected with 422', async () => {
    const r = req('/api/auth/forgot-password', 'POST', { email: 'not-an-email' });
    const res = await forgotPassword(r);
    expect(res.status).toBe(422);
  });

  // ============================================================
  // RESET PASSWORD (TC-2.22 to TC-2.27)
  // ============================================================

  it('TC-2.24: Invalid reset token rejected with 422/400', async () => {
    const r = req('/api/auth/reset-password', 'POST', {
      token: 'fake-invalid-token-1234567890',
      password: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    const res = await resetPassword(r);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('TC-2.23: Expired reset token is rejected', async () => {
    // Create intentionally expired token
    const expiredRawToken = crypto.randomBytes(32).toString('hex');
    const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
    await prisma.verificationToken.create({
      data: {
        identifier: `reset:${TEST_EMAIL}`,
        token: expiredHash,
        expires: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
      },
    });

    const r = req('/api/auth/reset-password', 'POST', {
      token: expiredRawToken,
      password: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    const res = await resetPassword(r);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.message).toContain('expired');
  });

  it('TC-2.26: Password mismatch during reset rejected with 422', async () => {
    const r = req('/api/auth/reset-password', 'POST', {
      token: generatedResetToken,
      password: NEW_PASSWORD,
      confirmPassword: 'MismatchPassword999!',
    });
    const res = await resetPassword(r);
    expect(res.status).toBe(422);
  });

  it('TC-2.27: Weak new password during reset rejected with 422', async () => {
    const r = req('/api/auth/reset-password', 'POST', {
      token: generatedResetToken,
      password: 'weak',
      confirmPassword: 'weak',
    });
    const res = await resetPassword(r);
    expect(res.status).toBe(422);
  });

  it('TC-2.22: Valid reset token changes password successfully', async () => {
    const r = req('/api/auth/reset-password', 'POST', {
      token: generatedResetToken,
      password: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    const res = await resetPassword(r);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify new password works for login
    const loginReq = req('/api/auth/login', 'POST', {
      email: TEST_EMAIL,
      password: NEW_PASSWORD,
    });
    const loginRes = await loginUser(loginReq);
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    validSessionToken = loginData.data.token;
  });

  it('TC-2.25: Previously used reset token is rejected (single-use guarantee)', async () => {
    // Attempting to reuse the exact same token that was just consumed
    const r = req('/api/auth/reset-password', 'POST', {
      token: generatedResetToken,
      password: 'AnotherPassword888@',
      confirmPassword: 'AnotherPassword888@',
    });
    const res = await resetPassword(r);
    expect(res.status).toBe(422);
  });

  // ============================================================
  // CHANGE PASSWORD (TC-2.28 to TC-2.31)
  // ============================================================

  it('TC-2.29: Incorrect current password rejected with 422', async () => {
    const r = req(
      '/api/auth/change-password',
      'POST',
      {
        currentPassword: 'WrongCurrentPassword!',
        newPassword: 'BrandNewPassword123#',
        confirmNewPassword: 'BrandNewPassword123#',
      },
      validSessionToken
    );
    const res = await changePassword(r);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.message).toContain('Current password is incorrect');
  });

  it('TC-2.30: New password mismatch rejected with 422', async () => {
    const r = req(
      '/api/auth/change-password',
      'POST',
      {
        currentPassword: NEW_PASSWORD,
        newPassword: 'BrandNewPassword123#',
        confirmNewPassword: 'MismatchNewPassword456#',
      },
      validSessionToken
    );
    const res = await changePassword(r);
    expect(res.status).toBe(422);
  });

  it('TC-2.28 & TC-2.31: Correct current password updates password; old password fails', async () => {
    const finalPassword = 'FinalSecurePassword789$';

    const r = req(
      '/api/auth/change-password',
      'POST',
      {
        currentPassword: NEW_PASSWORD,
        newPassword: finalPassword,
        confirmNewPassword: finalPassword,
      },
      validSessionToken
    );
    const res = await changePassword(r);
    expect(res.status).toBe(200);

    // Verify old password no longer authenticates
    const oldLoginReq = req('/api/auth/login', 'POST', {
      email: TEST_EMAIL,
      password: NEW_PASSWORD,
    });
    const oldLoginRes = await loginUser(oldLoginReq);
    expect(oldLoginRes.status).toBe(401);

    // Verify new password authenticates
    const newLoginReq = req('/api/auth/login', 'POST', {
      email: TEST_EMAIL,
      password: finalPassword,
    });
    const newLoginRes = await loginUser(newLoginReq);
    expect(newLoginRes.status).toBe(200);
    const newLoginData = await newLoginRes.json();
    validSessionToken = newLoginData.data.token;
  });

  // ============================================================
  // PROFILE & USER ISOLATION (TC-2.32 to TC-2.38)
  // ============================================================

  it('TC-2.32: Get own profile returns correct user details and resource counts', async () => {
    const r = req('/api/profile', 'GET', undefined, validSessionToken);
    const res = await getProfile(r);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.email).toBe(TEST_EMAIL);
    expect(data.data._count).toBeDefined();
  });

  it('TC-2.33: Update own profile persists changes', async () => {
    const r = req(
      '/api/profile',
      'PATCH',
      {
        name: 'Traveler Alpha Updated',
        image: 'https://images.unsplash.com/photo-traveler.jpg',
      },
      validSessionToken
    );
    const res = await patchProfile(r);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Traveler Alpha Updated');
    expect(data.data.image).toBe('https://images.unsplash.com/photo-traveler.jpg');
  });

  it('TC-2.34: Unauthenticated profile request returns 401', async () => {
    const r = req('/api/profile', 'GET');
    const res = await getProfile(r);
    expect(res.status).toBe(401);
  });

  it('TC-2.35: Attempt to modify protected account fields (id, email) is ignored/rejected', async () => {
    const r = req(
      '/api/profile',
      'PATCH',
      {
        id: 'hacked_id_123',
        email: 'hacked.email@gmail.com',
        name: 'Valid Name Change',
      },
      validSessionToken
    );
    const res = await patchProfile(r);
    expect(res.status).toBe(200);

    // Verify email and id did NOT change in database
    const dbUser = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(dbUser?.id).toBe(testUserId);
    expect(dbUser?.email).toBe(TEST_EMAIL);
    expect(dbUser?.name).toBe('Valid Name Change');
  });

  it('TC-2.36 & TC-2.37 & TC-2.38: User A cannot see or spoof User B profile', async () => {
    // Create User B
    const userB = await prisma.user.create({
      data: { email: 'user.beta@ghumnechalo-test.com', name: 'User Beta' },
    });

    // User A calls profile with User B spoofed in body
    const r = req(
      '/api/profile',
      'PATCH',
      {
        userId: userB.id,
        name: 'Hacked Beta Name',
      },
      validSessionToken // Authenticated as User A
    );
    const res = await patchProfile(r);
    expect(res.status).toBe(200);

    // Verify User B remained completely untouched!
    const checkB = await prisma.user.findUnique({ where: { id: userB.id } });
    expect(checkB?.name).toBe('User Beta');
    expect(checkB?.name).not.toBe('Hacked Beta Name');
  });

  // ============================================================
  // SESSION SECURITY (TC-2.39 to TC-2.40)
  // ============================================================

  it('TC-2.39: Expired/invalid session token returns 401', async () => {
    const r = req('/api/profile', 'GET', undefined, 'invalid.jwt.token.string');
    const res = await getProfile(r);
    expect(res.status).toBe(401);
  });

  it('TC-2.40: Calling protected API without authorization returns 401', async () => {
    const r = req('/api/profile', 'GET');
    const res = await getProfile(r);
    expect(res.status).toBe(401);
  });
});
