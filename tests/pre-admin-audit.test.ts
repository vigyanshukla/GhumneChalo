/**
 * PRE-ADMIN AUDIT REGRESSION TESTS
 *
 * Proves the three audit findings are resolved:
 * 1. Google sign-in route is correctly configured (exports GET + POST, trustHost set)
 * 2. Existing email/password authentication remains functional
 * 3. Unauthenticated protected routes are rejected/redirected correctly (proxy.ts)
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginUser } from '../src/app/api/auth/login/route';
import { POST as registerUser } from '../src/app/api/auth/register/route';
import { proxy, config as proxyConfig } from '../src/proxy';
import { verifySessionToken, createSessionToken, SESSION_COOKIE_NAME } from '../src/lib/session';

// ---------------------------------------------------------------------------
// 1. GOOGLE SIGN-IN ROUTE CONFIGURATION
// ---------------------------------------------------------------------------
describe('Pre-Admin Audit — Auth.js Google Sign-In Route', () => {
  it('AUDIT-1.1: /api/auth/[...nextauth] route.ts re-exports handlers from NextAuth', async () => {
    // next-auth v5 beta's lib/env.js uses bare 'next/server' imports that Vitest cannot
    // resolve in ESM mode. Verify via source inspection instead of dynamic import.
    const { readFileSync } = await import('fs');
    const routeSource = readFileSync('./src/app/api/auth/[...nextauth]/route.ts', 'utf-8');
    expect(routeSource).toContain("import { handlers } from '@/lib/auth'");
    expect(routeSource).toContain('export const { GET, POST } = handlers');
  });

  it('AUDIT-1.2: auth.ts correctly calls NextAuth() and exports handlers/auth/signIn/signOut', async () => {
    const { readFileSync } = await import('fs');
    const authSource = readFileSync('./src/lib/auth.ts', 'utf-8');
    expect(authSource).toContain('NextAuth(');
    expect(authSource).toContain('handlers');
    expect(authSource).toContain('export const { handlers, auth, signIn, signOut }');
  });

  it('AUDIT-1.3: trustHost is set in NextAuth config (no UntrustedHost in dev/localhost)', async () => {
    // Read the source file to verify trustHost is present in the config object
    const { readFileSync } = await import('fs');
    const authSource = readFileSync('./src/lib/auth.ts', 'utf-8');
    expect(authSource).toContain('trustHost: true');
  });

  it('AUDIT-1.4: Google sign-in initiator uses a form POST (not router.push or window.location)', async () => {
    // Verify the login page no longer contains the window.location or router.push approach
    const { readFileSync } = await import('fs');
    const loginSource = readFileSync('./src/app/login/page.tsx', 'utf-8');
    // Must NOT use window.location for OAuth
    expect(loginSource).not.toContain("window.location.href = '/api/auth/signin/google'");
    // Must NOT use router.push for OAuth
    expect(loginSource).not.toContain("router.push('/api/auth/signin/google')");
    // Must use form POST (the correct Auth.js pattern)
    expect(loginSource).toContain('method="POST"');
    expect(loginSource).toContain('action="/api/auth/signin/google"');
  });

  it('AUDIT-1.5: Google provider only active when env vars are configured', async () => {
    const { readFileSync } = await import('fs');
    const authSource = readFileSync('./src/lib/auth.ts', 'utf-8');
    // Confirms the guard pattern exists
    expect(authSource).toContain('GOOGLE_CLIENT_ID');
    expect(authSource).toContain('GOOGLE_CLIENT_SECRET');
    expect(authSource).toContain('isGoogleConfigured');
  });
});

// ---------------------------------------------------------------------------
// 2. EMAIL/PASSWORD AUTHENTICATION — FUNCTIONAL REGRESSION
// ---------------------------------------------------------------------------
describe('Pre-Admin Audit — Email/Password Auth Regression', () => {
  const AUDIT_EMAIL = 'audit-regression@ghumnechalo-preaudit.test';
  const AUDIT_PASSWORD = 'AuditPassword1!';

  function makeReq(url: string, method = 'POST', body?: unknown) {
    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  it('AUDIT-2.1: Registration still creates user and returns JWT token', async () => {
    const res = await registerUser(
      makeReq('/api/auth/register', 'POST', {
        name: 'Audit User',
        email: AUDIT_EMAIL,
        password: AUDIT_PASSWORD,
        confirmPassword: AUDIT_PASSWORD,
      })
    );
    // 201 = created, 409 = already exists from a previous run — both are acceptable
    expect([201, 409]).toContain(res.status);
    if (res.status === 201) {
      const data = await res.json();
      expect(data.data.token).toBeDefined();
      const verified = await verifySessionToken(data.data.token);
      expect(verified?.email).toBe(AUDIT_EMAIL);
    }
  });

  it('AUDIT-2.2: Login still works and returns a verifiable JWT', async () => {
    const res = await loginUser(
      makeReq('/api/auth/login', 'POST', {
        email: AUDIT_EMAIL,
        password: AUDIT_PASSWORD,
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.token).toBeDefined();

    // JWT round-trip: must be verifiable with the same secret
    const payload = await verifySessionToken(data.data.token);
    expect(payload).not.toBeNull();
    expect(payload?.email).toBe(AUDIT_EMAIL);
  });

  it('AUDIT-2.3: Wrong password still returns 401', async () => {
    const res = await loginUser(
      makeReq('/api/auth/login', 'POST', {
        email: AUDIT_EMAIL,
        password: 'WrongPassword999!',
      })
    );
    expect(res.status).toBe(401);
  });

  it('AUDIT-2.4: JWT session token verification still works end-to-end', async () => {
    const token = await createSessionToken({ userId: 'test-id', email: 'test@test.com', name: 'Test' });
    const payload = await verifySessionToken(token);
    expect(payload?.userId).toBe('test-id');
    expect(payload?.email).toBe('test@test.com');
  });

  it('AUDIT-2.5: Invalid JWT returns null from verifySessionToken', async () => {
    const payload = await verifySessionToken('invalid.jwt.string');
    expect(payload).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. PROXY.TS (middleware → proxy) — PROTECTED ROUTE REGRESSION
// ---------------------------------------------------------------------------
describe('Pre-Admin Audit — proxy.ts Auth/Route Protection', () => {
  it('AUDIT-3.1: proxy.ts is the active routing file (middleware.ts deleted, proxy.ts present)', async () => {
    const { existsSync } = await import('fs');
    expect(existsSync('./src/proxy.ts')).toBe(true);
    expect(existsSync('./src/middleware.ts')).toBe(false);
    expect(typeof proxy).toBe('function');
    expect(Array.isArray(proxyConfig.matcher)).toBe(true);
  });

  it('AUDIT-3.2: SESSION_COOKIE_NAME is "auth_session"', () => {
    expect(SESSION_COOKIE_NAME).toBe('auth_session');
  });

  it('AUDIT-3.3: Unauthenticated request to protected page redirects to /login', async () => {
    const req = new NextRequest('http://localhost:3000/trips', { method: 'GET' });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('AUDIT-3.4: Unauthenticated request to protected API returns 401 JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/trips', { method: 'GET' });
    const res = await proxy(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('AUDIT-3.5: Authenticated request to protected page proceeds without redirect', async () => {
    const token = await createSessionToken({ userId: 'proxy-test-user', email: 'proxy@test.com' });
    const req = new NextRequest('http://localhost:3000/trips', {
      method: 'GET',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(401);
  });

  it('AUDIT-3.6: Authenticated user on login page is redirected to /home', async () => {
    const token = await createSessionToken({ userId: 'proxy-redir-user', email: 'redir@test.com' });
    const req = new NextRequest('http://localhost:3000/login', {
      method: 'GET',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/home');
  });

  it('AUDIT-3.7: Public routes pass through without redirect', async () => {
    const req = new NextRequest('http://localhost:3000/', { method: 'GET' });
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(401);
  });

  it('AUDIT-3.8: callbackUrl is set on redirect to enable deep linking after login', async () => {
    const req = new NextRequest('http://localhost:3000/achievements', { method: 'GET' });
    const res = await proxy(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('callbackUrl');
    expect(location).toContain('%2Fachievements');
  });
});
