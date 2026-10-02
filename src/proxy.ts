import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from './lib/session';
import { decode } from 'next-auth/jwt';

// Protected path prefixes
const PROTECTED_PAGE_PREFIXES = [
  '/home',
  '/profile',
  '/trips',
  '/planner',
  '/saved',
  '/notifications',
  '/achievements',
  '/reminders',
  '/settings',
];

const PROTECTED_API_PREFIXES = [
  '/api/profile',
  '/api/trips',
  '/api/saved',
  '/api/notifications',
  '/api/achievements',
  '/api/reminders',
  '/api/search',
];

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Extract session token from cookie or Authorization header
  const token =
    request.cookies.get(SESSION_COOKIE_NAME)?.value ||
    (request.headers.get('authorization')?.startsWith('Bearer ')
      ? request.headers.get('authorization')!.substring(7).trim()
      : undefined);

  let isAuthenticated = false;
  if (token) {
    const payload = await verifySessionToken(token);
    if (payload) {
      isAuthenticated = true;
    }
  }

  // 2. Fallback to Auth.js (NextAuth v5) session tokens for Google OAuth
  if (!isAuthenticated) {
    const authJsToken =
      request.cookies.get('authjs.session-token')?.value ||
      request.cookies.get('__Secure-authjs.session-token')?.value ||
      request.cookies.get('next-auth.session-token')?.value ||
      request.cookies.get('__Secure-next-auth.session-token')?.value;

    if (authJsToken) {
      const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
      const salt = request.cookies.get('__Secure-authjs.session-token')
        ? '__Secure-authjs.session-token'
        : request.cookies.get('authjs.session-token')
        ? 'authjs.session-token'
        : request.cookies.get('__Secure-next-auth.session-token')
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token';

      try {
        const decoded = await decode({ token: authJsToken, secret, salt });
        if (decoded?.sub || decoded?.email) {
          isAuthenticated = true;
        }
      } catch {
        // Fallback or invalid token
      }
    }
  }

  // Check if authenticated user visits public root "/" -> redirect to /home
  if (isAuthenticated && pathname === '/') {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  // Check if accessing an auth page while already logged in -> redirect to /home
  if (isAuthenticated && AUTH_PAGES.some((path) => pathname === path)) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  // Check protected API routes
  if (PROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!isAuthenticated) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please sign in.',
          },
        },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Check protected page routes
  if (PROTECTED_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
