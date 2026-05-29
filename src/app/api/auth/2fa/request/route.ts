import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute } from "@/lib/api";
import { twoFactorRequestSchema } from "@/lib/validators";
import { getSettings } from "@/lib/settings";
import { sha256, randomNumericCode } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { sendTwoFactorCode } from "@/lib/email/send";

export const dynamic = "force-dynamic";

const CODE_TTL_MINUTES = 10;

/**
 * Step 1 of the 2FA login flow. Verifies email + password; if 2FA is enabled,
 * generates and emails a one-time code and tells the client a code is required.
 * If 2FA is disabled, simply reports that the client may proceed to sign in.
 *
 * Returns a uniform 401 on bad credentials (no user enumeration).
 */
export async function POST(req: Request) {
  return handleRoute(async () => {
    const { email: rawEmail, password } = twoFactorRequestSchema.parse(
      await req.json()
    );
    const email = rawEmail.toLowerCase().trim();

    // Throttle: limits both password guessing and code-email spam per address.
    const limit = rateLimit(`2fa-request:${email}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      throw new ApiError(
        `Too many attempts. Try again in ${limit.retryAfterSeconds}s.`,
        429
      );
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    const valid = admin
      ? await bcrypt.compare(password, admin.password)
      : false;

    if (!admin || !valid) {
      throw new ApiError("Invalid email or password", 401);
    }

    const settings = await getSettings();
    if (!settings.twoFactorEnabled) {
      return { twoFactorRequired: false };
    }

    // Generate, hash-store, and email a one-time code.
    const code = randomNumericCode(6);
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        twoFactorCodeHash: sha256(code),
        twoFactorCodeExpiry: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
        twoFactorAttempts: 0,
      },
    });

    try {
      await sendTwoFactorCode({
        email: admin.email,
        name: admin.name,
        code,
        expiresInMinutes: CODE_TTL_MINUTES,
      });
    } catch (err) {
      // Don't fail the request if email infra is down — log so the flow stays
      // testable locally; in production a delivery failure just means no code.
      console.error("[2fa] failed to send code:", err);
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[2fa] login code for ${admin.email}: ${code}`);
    }

    return { twoFactorRequired: true };
  });
}
