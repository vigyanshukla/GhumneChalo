import { clearSessionCookie, ALL_AUTH_COOKIE_NAMES } from '@/lib/session';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { clearUserCache } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

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

    // 2. Clear NextAuth session if available
    try {
      const { signOut } = await import('@/lib/auth');
      await signOut({ redirect: false }).catch(() => {});
    } catch {}

    // 3. Clear all server-side session cookies via cookieStore
    await clearSessionCookie();

    // 4. Invalidate server-side in-memory user cache
    clearUserCache();

    // 5. Construct response and explicitly attach Set-Cookie clearing headers to the response itself
    const response = apiSuccess({ message: 'Logged out successfully' });

    for (const cookieName of ALL_AUTH_COOKIE_NAMES) {
      response.cookies.set(cookieName, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      response.cookies.delete(cookieName);
    }

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  return POST();
}
