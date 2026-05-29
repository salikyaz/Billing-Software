import { prisma } from "@/lib/prisma";
import { handleRoute, requireAdmin } from "@/lib/api";
import { toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Window for revenue-by-month: start of the month 5 months ago.
    const windowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      paidThisMonth,
      pending,
      overdue,
      paidInWindow,
      recentInvoices,
    ] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          status: "PAID",
          paidAt: { gte: monthStart, lt: nextMonthStart },
        },
        select: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { status: "SENT" },
        _count: true,
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { status: "OVERDUE" },
        _count: true,
        _sum: { total: true },
      }),
      prisma.invoice.findMany({
        where: { status: "PAID", paidAt: { gte: windowStart } },
        select: { total: true, paidAt: true },
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { client: true },
      }),
    ]);

    const totalRevenueThisMonth = paidThisMonth.reduce(
      (sum, inv) => sum + toNumber(inv.total),
      0
    );

    // Build the last 6 month buckets (including current), oldest first.
    const buckets: { key: string; month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      });
      buckets.push({ key, month: label, total: 0 });
    }
    const bucketByKey = new Map(buckets.map((b) => [b.key, b]));

    for (const inv of paidInWindow) {
      if (!inv.paidAt) continue;
      const key = `${inv.paidAt.getFullYear()}-${inv.paidAt.getMonth()}`;
      const bucket = bucketByKey.get(key);
      if (bucket) bucket.total += toNumber(inv.total);
    }

    return {
      totalRevenueThisMonth,
      paidThisMonthCount: paidThisMonth.length,
      pendingCount: pending._count,
      pendingAmount: toNumber(pending._sum.total),
      overdueCount: overdue._count,
      overdueAmount: toNumber(overdue._sum.total),
      revenueByMonth: buckets.map((b) => ({ month: b.month, total: b.total })),
      recentInvoices,
    };
  });
}
