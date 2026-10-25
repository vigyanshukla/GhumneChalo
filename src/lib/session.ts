import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET_KEY = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'ghumnechalo-development-secret-key-change-in-production-min-32-chars'
);

export const SESSION_COOKIE_NAME = 'auth_session';

export interface SessionPayload {
  userId: string;
  email: string;
  name?: string | null;
  [key: string]: unknown;
}

/**
 * Creates a cryptographically signed JWT session token valid for 7 days.
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name || '',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

/**
 * Verifies a JWT session token. Returns null if invalid or expired.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      algorithms: ['HS256'],
    });

    if (!payload.userId || !payload.email) {
      return null;
    }

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string | null,
    };
  } catch {
    return null;
  }
}

/**
 * Attaches the session cookie to the response headers when inside Next.js request lifecycle.
 */
export async function setSessionCookie(token: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
  } catch {
    // In standalone testing environments where Next requestAsyncStorage is not mounted
  }
}

export const ALL_AUTH_COOKIE_NAMES = [
  SESSION_COOKIE_NAME,
  'auth_session',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
  'next-auth.pkce.code_verifier',
  '__Secure-next-auth.pkce.code_verifier',
  'authjs.pkce.code_verifier',
  '__Secure-authjs.pkce.code_verifier',
] as const;

/**
 * Clears all authentication session cookies on logout.
 */
export async function clearSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    for (const name of ALL_AUTH_COOKIE_NAMES) {
      try {
        cookieStore.delete(name);
      } catch {}
      try {
        cookieStore.set(name, '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
          expires: new Date(0),
        });
      } catch {}
    }
  } catch {
    // In standalone testing environments where Next requestAsyncStorage is not mounted
  }
}
