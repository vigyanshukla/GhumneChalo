import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';
import { UnauthorizedError } from './api-error';
import { verifySessionToken, SESSION_COOKIE_NAME } from './session';
import { decode } from 'next-auth/jwt';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

const userCache = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();
 
export function clearUserCache(): void {
   userCache.clear();
 }

/**
 * Extracts and verifies the authenticated user from server session or request headers.
 * NEVER trusts `req.body.userId` or `query.userId`.
 */
export async function getAuthenticatedUser(request?: Request): Promise<AuthenticatedUser> {
  // 1. Check for Authorization header (Bearer token or test user ID)
  let authHeader: string | null = null;
  if (request) {
    authHeader = request.headers.get('authorization') || request.headers.get('x-user-id');
  } else {
    try {
      const headersList = await headers();
      authHeader = headersList.get('authorization') || headersList.get('x-user-id');
    } catch {
      // In non-header context
    }
  }

  if (authHeader) {
    const rawToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
    if (rawToken) {
      // Fast cache hit
      const cached = userCache.get(rawToken);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.user;
      }

      // First try decoding as JWT session token
      const jwtPayload = await verifySessionToken(rawToken);
      if (jwtPayload) {
        const user = await prisma.user.findUnique({
          where: { id: jwtPayload.userId },
          select: { id: true, email: true, name: true, image: true },
        });
        if (user) {
          userCache.set(rawToken, { user, expiresAt: Date.now() + 30000 });
          return user;
        }
      }

      // Fast path: primary key lookup by user ID directly
      try {
        const directUser = await prisma.user.findUnique({
          where: { id: rawToken },
          select: { id: true, email: true, name: true, image: true },
        });
        if (directUser) {
          userCache.set(rawToken, { user: directUser, expiresAt: Date.now() + 30000 });
          return directUser;
        }
      } catch {
        // Fall through to sessions lookup
      }

      // Check if it's a database session token
      const sessionUser = await prisma.user.findFirst({
        where: {
          sessions: { some: { sessionToken: rawToken, expires: { gt: new Date() } } },
        },
        select: { id: true, email: true, name: true, image: true },
      });

      if (sessionUser) {
        userCache.set(rawToken, { user: sessionUser, expiresAt: Date.now() + 30000 });
        return sessionUser;
      }
    }
  }

  // 2. Check for auth_session cookie
  try {
    let sessionToken: string | undefined;

    const reqWithCookies = request as (Request & { cookies?: { get(name: string): { value: string } | undefined } }) | undefined;
    if (reqWithCookies?.cookies && typeof reqWithCookies.cookies.get === 'function') {
      sessionToken = reqWithCookies.cookies.get(SESSION_COOKIE_NAME)?.value;
    } else {
      const cookieStore = await cookies();
      sessionToken =
        cookieStore.get(SESSION_COOKIE_NAME)?.value ||
        cookieStore.get('next-auth.session-token')?.value ||
        cookieStore.get('__Secure-next-auth.session-token')?.value;
    }

    if (sessionToken) {
      // Fast cache hit
      const cached = userCache.get(sessionToken);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.user;
      }

      const jwtPayload = await verifySessionToken(sessionToken);
      if (jwtPayload) {
        const user = await prisma.user.findUnique({
          where: { id: jwtPayload.userId },
          select: { id: true, email: true, name: true, image: true },
        });
        if (user) {
          userCache.set(sessionToken, { user, expiresAt: Date.now() + 60000 });
          return user;
        }
      }

      // Fallback: check database sessions table
      const dbSession = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: { select: { id: true, email: true, name: true, image: true } } },
      });

      if (dbSession && dbSession.expires > new Date()) {
        userCache.set(sessionToken, { user: dbSession.user, expiresAt: Date.now() + 60000 });
        return dbSession.user;
      }
    }

    // 3. Fallback: Check Auth.js (NextAuth v5) Google OAuth session tokens
    const cookieStore = await cookies();
    const authJsToken =
      cookieStore.get('authjs.session-token')?.value ||
      cookieStore.get('__Secure-authjs.session-token')?.value ||
      cookieStore.get('next-auth.session-token')?.value ||
      cookieStore.get('__Secure-next-auth.session-token')?.value;

    if (authJsToken) {
      const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
      const salt = cookieStore.get('__Secure-authjs.session-token')
        ? '__Secure-authjs.session-token'
        : cookieStore.get('authjs.session-token')
        ? 'authjs.session-token'
        : cookieStore.get('__Secure-next-auth.session-token')
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token';

      try {
        const decoded = await decode({ token: authJsToken, secret, salt });
        if (decoded?.email) {
          const user = await prisma.user.findUnique({
            where: { email: (decoded.email as string).toLowerCase().trim() },
            select: { id: true, email: true, name: true, image: true },
          });
          if (user) return user;
        } else if (decoded?.sub) {
          const user = await prisma.user.findUnique({
            where: { id: decoded.sub as string },
            select: { id: true, email: true, name: true, image: true },
          });
          if (user) return user;
        }
      } catch {
        // Fallback or invalid token
      }
    }
  } catch {
    // Cookie store read failure
  }

  throw new UnauthorizedError('Authentication required. Please sign in.');
}

/**
 * Ensures user is authenticated, throws UnauthorizedError if not.
 */
export async function requireAuth(request?: Request): Promise<AuthenticatedUser> {
  return getAuthenticatedUser(request);
}

/**
 * Returns authenticated user or null if not authenticated (guest).
 */
export async function getOptionalAuthenticatedUser(request?: Request): Promise<AuthenticatedUser | null> {
  try {
    return await getAuthenticatedUser(request);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return null;
    }
    return null;
  }
}
