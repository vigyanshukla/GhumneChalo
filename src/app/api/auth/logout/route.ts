import { clearSessionCookie, ALL_AUTH_COOKIE_NAMES } from '@/lib/session';
import { clearUserCache } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
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

    // 4. Construct response and attach Set-Cookie clearing headers and Clear-Site-Data
    const response = NextResponse.json(
      { success: true, data: { message: 'Logged out successfully' } },
      {
        status: 200,
        headers: {
          'Clear-Site-Data': '"cache", "cookies", "storage"',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );

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
    const fallbackResponse = NextResponse.json(
      { success: true, data: { message: 'Logged out successfully' } },
      {
        status: 200,
        headers: {
          'Clear-Site-Data': '"cache", "cookies", "storage"',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
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

export async function GET() {
  return POST();
}
