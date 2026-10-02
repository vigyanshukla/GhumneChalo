import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { skipCSRFCheck } from '@auth/core';
import { handleGoogleSignIn } from './auth-oauth';

export { handleGoogleSignIn };

const isGoogleConfigured = !!(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  skipCSRFCheck,
  providers: [
    ...(isGoogleConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  trustHost: true,
  callbacks: {
    async signIn({ user, account }) {
      return handleGoogleSignIn({ user, account });
    },
    async session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {}
      return `${baseUrl}/home`;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
