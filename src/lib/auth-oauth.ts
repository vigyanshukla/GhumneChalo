import { prisma } from './prisma';
import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';

export async function handleGoogleSignIn({
  user,
  account,
}: {
  user: { email?: string | null; name?: string | null; image?: string | null };
  account?: {
    provider?: string;
    providerAccountId?: string;
    type?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    token_type?: string;
    scope?: string;
    id_token?: string;
  } | null;
}): Promise<boolean> {
  if (!user.email) return false;

  try {
    const email = user.email.toLowerCase().trim();

    // Check if user is currently signed in (Account Binding flow from Security Settings)
    let currentUserId: string | null = null;
    try {
      const cookieStore = await cookies();
      const token =
        cookieStore.get('authjs.session-token')?.value ||
        cookieStore.get('__Secure-authjs.session-token')?.value;
      if (token) {
        const decoded = await decode({
          token,
          secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '',
          salt: cookieStore.get('authjs.session-token') ? 'authjs.session-token' : '__Secure-authjs.session-token',
        });
        if (decoded?.sub) {
          currentUserId = decoded.sub;
        }
      }
    } catch {
      // Non-blocking fallback
    }

    let dbUser = null;
    if (currentUserId) {
      dbUser = await prisma.user.findUnique({
        where: { id: currentUserId },
        include: { accounts: true },
      });
    }

    if (!dbUser) {
      dbUser = await prisma.user.findUnique({
        where: { email },
        include: { accounts: true },
      });
    }

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email,
          name: user.name || '',
          image: user.image || '',
          emailVerified: new Date(), // Google emails are verified by Google
        },
        include: { accounts: true },
      });
    } else if (!dbUser.emailVerified) {
      // Google verified identity automatically marks email as verified
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { emailVerified: new Date() },
      });
    }

    // 2. Safely link Google Account if account info is provided and not already linked
    if (account && account.provider === 'google' && account.providerAccountId) {
      const alreadyLinked = dbUser.accounts.some(
        (a) => a.provider === 'google' && a.providerAccountId === account.providerAccountId
      );

      if (!alreadyLinked) {
        await prisma.account.create({
          data: {
            userId: dbUser.id,
            type: account.type || 'oauth',
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          },
        });
      }
    }

    return true;
  } catch (err) {
    console.error('[Google OAuth SignIn Error]:', err);
    return false;
  }
}
