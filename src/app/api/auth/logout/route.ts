import { clearSessionCookie, ALL_AUTH_COOKIE_NAMES } from '@/lib/session';
import { clearUserCache } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request?: NextRequest) {
  try {
    // 1. Delete database session records if matching token is found
    try {
      const cookieStore = await cookies();
      const tokensToDelete: string[] = [];
      for (const name of ALL_AUTH_COOKIE_NAMES) {
        const val = cookieStore.get(name)?.value;
        if (val) tokensToDelete.push(val);
      }
      if (tokensToDelete.length > 0) {
        await prisma.session.deleteMany({
          where: { sessionToken: { in: tokensToDelete } },
        }).catch(() => {});
      }
    } catch {}

    // 2. Clear all server-side session cookies via cookieStore
    await clearSessionCookie();

    // 3. Invalidate server-side in-memory user cache
    clearUserCache();

    // 4. Construct response: redirect if redirect query param is provided, else JSON
    const baseUrl = request?.url || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const redirectParam = request?.nextUrl?.searchParams?.get('redirect');
    const response = redirectParam
      ? NextResponse.redirect(new URL(redirectParam, baseUrl))
      : NextResponse.json(
          { success: true, data: { message: 'Logged out successfully' } },
          { status: 200 }
        );

    response.headers.set('Clear-Site-Data', '"cache", "cookies", "storage"');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    // 5. Expire every known auth cookie explicitly on the response
    for (const cookieName of ALL_AUTH_COOKIE_NAMES) {
      response.cookies.set(cookieName, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      if (cookieName.startsWith('__Secure-') || cookieName.startsWith('__Host-')) {
        response.cookies.set(cookieName, '', {
          path: '/',
          maxAge: 0,
          expires: new Date(0),
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
        });
      }
    }

    return response;
  } catch (error) {
    console.error('[Logout Route Error]:', error);
    const baseUrl = request?.url || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const redirectParam = request?.nextUrl?.searchParams?.get('redirect');
    const fallbackResponse = redirectParam
      ? NextResponse.redirect(new URL(redirectParam, baseUrl))
      : NextResponse.json(
          { success: true, data: { message: 'Logged out successfully' } },
          { status: 200 }
        );

    fallbackResponse.headers.set('Clear-Site-Data', '"cache", "cookies", "storage"');
    fallbackResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    for (const cookieName of ALL_AUTH_COOKIE_NAMES) {
      fallbackResponse.cookies.set(cookieName, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        httpOnly: true,
        sameSite: 'lax',
      });
    }
    return fallbackResponse;
  }
}

export async function GET(request: NextRequest) {
  const redirectParam = request.nextUrl.searchParams.get('redirect') || '/login?logged_out=1';
  const urlWithRedirect = new URL(request.url);
  urlWithRedirect.searchParams.set('redirect', redirectParam);
  const updatedReq = new NextRequest(urlWithRedirect, request);
  return POST(updatedReq);
}
