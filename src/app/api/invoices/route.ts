import { Prisma, type InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute, requireAdmin } from "@/lib/api";
import { invoiceSchema } from "@/lib/validators";
import { computeInvoiceTotals } from "@/lib/invoice-calc";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { getSettings } from "@/lib/settings";
import { toNumber, addDays } from "@/lib/utils";
import { DEFAULTS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const VALID_STATUSES: InvoiceStatus[] = [
  "DRAFT",
  "SENT",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];

export async function GET(req: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Prisma.InvoiceWhereInput = {};
    if (status && VALID_STATUSES.includes(status as InvoiceStatus)) {
      where.status = status as InvoiceStatus;
    }
    if (clientId) where.clientId = clientId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    return prisma.invoice.findMany({
      where,
      include: { client: true, items: true },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function POST(req: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const body = invoiceSchema.parse(await req.json());

    const settings = await getSettings();

    const client = await prisma.client.findUnique({
      where: { id: body.clientId },
    });
    if (!client) throw new ApiError("Client not found", 404);

    const taxRate =
      body.taxRate ?? toNumber(settings.taxRate);

    const totals = computeInvoiceTotals(
      body.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        serviceId: i.serviceId ?? null,
      })),
      taxRate
    );

    const currency =
      body.currency ?? client.currency ?? settings.defaultCurrency;

    const dueDate = body.dueDate
      ? new Date(body.dueDate)
      : addDays(new Date(), DEFAULTS.DUE_DATE_DAYS);

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await generateInvoiceNumber(
        settings.invoiceNumberPrefix,
        tx
      );

      return tx.invoice.create({
        data: {
          invoiceNumber,
          clientId: body.clientId,
          status: "DRAFT",
          subtotal: totals.subtotal,
          taxRate: totals.taxRate,
          tax: totals.tax,
          total: totals.total,
          currency,
          notes: body.notes ?? null,
          dueDate,
          items: {
            create: totals.items.map((i) => ({
              serviceId: i.serviceId ?? null,
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.total,
            })),
          },
        },
        include: { items: true, client: true },
      });
    });

    return invoice;
  });
}
