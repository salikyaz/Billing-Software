import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validators";
import { sendPasswordResetEmail } from "@/lib/email/send";
import { sha256, randomToken } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EXPIRY_MINUTES = 60;

export async function POST(req: Request) {
  return handleRoute(async () => {
    const { email: rawEmail } = forgotPasswordSchema.parse(await req.json());
    const email = rawEmail.toLowerCase().trim();

    const limit = rateLimit(`forgot:${email}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) {
      throw new ApiError(
        `Too many requests. Try again in ${limit.retryAfterSeconds}s.`,
        429
      );
    }

    const admin = await prisma.admin.findUnique({ where: { email } });

    // Always behave the same way regardless of whether the account exists,
    // to avoid leaking which emails are registered.
    if (admin) {
      const rawToken = randomToken(32);
      const expiry = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

      await prisma.admin.update({
        where: { id: admin.id },
        data: { resetTokenHash: sha256(rawToken), resetTokenExpiry: expiry },
      });

      const base = (
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.NEXTAUTH_URL ??
        new URL(req.url).origin
      ).replace(/\/$/, "");
      const resetUrl = `${base}/reset-password?token=${rawToken}`;

      try {
        await sendPasswordResetEmail({
          email: admin.email,
          name: admin.name,
          resetUrl,
          expiresInMinutes: EXPIRY_MINUTES,
        });
      } catch (err) {
        // Email infra may be unconfigured (e.g. local dev). Don't fail the
        // request — log so the flow is still testable from the server console.
        console.error("[forgot-password] email send failed:", err);
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(`[forgot-password] reset link for ${admin.email}: ${resetUrl}`);
      }
    }

    return {
      ok: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };
  });
}
