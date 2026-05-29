import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validators";
import { sendPasswordResetEmail } from "@/lib/email/send";

export const dynamic = "force-dynamic";

const EXPIRY_MINUTES = 60;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: Request) {
  return handleRoute(async () => {
    const { email } = forgotPasswordSchema.parse(await req.json());
    const admin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Always behave the same way regardless of whether the account exists,
    // to avoid leaking which emails are registered.
    if (admin) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

      await prisma.admin.update({
        where: { id: admin.id },
        data: { resetTokenHash: hashToken(rawToken), resetTokenExpiry: expiry },
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
