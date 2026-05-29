import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { sha256, timingSafeEqualStr } from "@/lib/crypto";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

// Max wrong 2FA code guesses before the active code is invalidated.
const MAX_2FA_ATTEMPTS = 5;

export const authOptions: NextAuthOptions = {
  // Shorter session for an admin/billing app (8 hours).
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();

        // Throttle login attempts per email (brute-force protection).
        const limit = rateLimit(`login:${email}`, 10, 15 * 60 * 1000);
        if (!limit.allowed) {
          throw new Error("Too many attempts. Please try again later.");
        }

        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin) return null;

        const valid = await bcrypt.compare(credentials.password, admin.password);
        if (!valid) return null;

        // If email 2FA is enabled, a valid, unexpired code is also required.
        const settings = await getSettings();
        if (settings.twoFactorEnabled) {
          const code = (credentials.code ?? "").trim();
          const codeValid =
            !!code &&
            !!admin.twoFactorCodeHash &&
            !!admin.twoFactorCodeExpiry &&
            admin.twoFactorCodeExpiry.getTime() >= Date.now() &&
            admin.twoFactorAttempts < MAX_2FA_ATTEMPTS &&
            timingSafeEqualStr(admin.twoFactorCodeHash, sha256(code));

          if (!codeValid) {
            // Count the failed guess; invalidate the code after too many so a
            // fresh one must be requested (limits brute-forcing the 6 digits).
            if (admin.twoFactorCodeHash) {
              const attempts = admin.twoFactorAttempts + 1;
              await prisma.admin.update({
                where: { id: admin.id },
                data:
                  attempts >= MAX_2FA_ATTEMPTS
                    ? {
                        twoFactorCodeHash: null,
                        twoFactorCodeExpiry: null,
                        twoFactorAttempts: 0,
                      }
                    : { twoFactorAttempts: attempts },
              });
            }
            return null;
          }
          // Success: consume the code and reset the attempt counter.
          await prisma.admin.update({
            where: { id: admin.id },
            data: {
              twoFactorCodeHash: null,
              twoFactorCodeExpiry: null,
              twoFactorAttempts: 0,
            },
          });
        }

        // Successful login — clear the throttle.
        resetRateLimit(`login:${email}`);
        return { id: admin.id, email: admin.email, name: admin.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
    // Only ever redirect to same-origin URLs (defense against open redirects).
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        /* fall through */
      }
      return baseUrl;
    },
  },
};
