import { prisma } from "@/lib/prisma";
import { handleRoute, requireAdmin } from "@/lib/api";
import { clientSchema } from "@/lib/validators";
import { toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();

    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Sum total of non-cancelled invoices grouped by client.
    const grouped = await prisma.invoice.groupBy({
      by: ["clientId"],
      where: { status: { not: "CANCELLED" } },
      _sum: { total: true },
    });

    const totals = new Map<string, number>();
    for (const g of grouped) {
      totals.set(g.clientId, toNumber(g._sum.total));
    }

    return clients.map((c) => ({
      ...c,
      totalBilled: totals.get(c.id) ?? 0,
    }));
  });
}

export async function POST(req: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const data = clientSchema.parse(await req.json());
    return prisma.client.create({ data });
  });
}
