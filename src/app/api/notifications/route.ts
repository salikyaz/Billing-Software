import { prisma } from "@/lib/prisma";
import { handleRoute, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.notification.count({ where: { isRead: false } }),
    ]);

    return { items, unreadCount };
  });
}
