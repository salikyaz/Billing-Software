import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: Request) {
  return handleRoute(async () => {
    const { token, password } = resetPasswordSchema.parse(await req.json());

    const admin = await prisma.admin.findFirst({
      where: {
        resetTokenHash: hashToken(token),
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
