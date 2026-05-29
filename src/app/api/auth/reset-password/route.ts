import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validators";
import { sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleRoute(async () => {
    const { token, password } = resetPasswordSchema.parse(await req.json());

    // Throttle token-guessing attempts.
    const limit = rateLimit(`reset:${sha256(token).slice(0, 16)}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      throw new ApiError("Too many attempts. Please try again later.", 429);
    }

    const admin = await prisma.admin.findFirst({
      where: {
        resetTokenHash: sha256(token),
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!admin) {
      throw new ApiError("This reset link is invalid or has expired.", 400);
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        password: hashed,
        resetTokenHash: null,
        resetTokenExpiry: null,
      },
    });

    return { ok: true };
  });
}
