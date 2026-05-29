import { prisma } from "@/lib/prisma";
import { handleRoute, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  return handleRoute(async () => {
    await requireAdmin();

    let id: string | undefined;
    try {
      const body = (await req.json()) as { id?: string };
      id = body?.id;
    } catch {
      // No body provided -> mark all read.
    }

    if (id) {
      await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });
    }

    return { ok: true };
  });
}
