import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute, requireAdmin } from "@/lib/api";
import { invoiceSchema } from "@/lib/validators";
import { computeInvoiceTotals } from "@/lib/invoice-calc";
import { getSettings } from "@/lib/settings";
import { toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        items: { include: { service: true } },
        emailLogs: { orderBy: { sentAt: "desc" } },
        notifications: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!invoice) throw new ApiError("Invoice not found", 404);
    return invoice;
  });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();

    const existing = await prisma.invoice.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Invoice not found", 404);
    if (existing.status !== "DRAFT") {
      throw new ApiError("Only draft invoices can be edited", 409);
    }

    const body = invoiceSchema.parse(await req.json());
    const settings = await getSettings();

    const taxRate = body.taxRate ?? toNumber(settings.taxRate);

    const totals = computeInvoiceTotals(
      body.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        serviceId: i.serviceId ?? null,
      })),
      taxRate
    );

    const currency = body.currency ?? existing.currency;
    const dueDate = body.dueDate ? new Date(body.dueDate) : existing.dueDate;

    return prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: params.id } });

      return tx.invoice.update({
        where: { id: params.id },
        data: {
          clientId: body.clientId,
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
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();

    const existing = await prisma.invoice.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Invoice not found", 404);

    if (existing.status === "DRAFT") {
      await prisma.invoice.delete({ where: { id: params.id } });
    } else {
      await prisma.invoice.update({
        where: { id: params.id },
        data: { status: "CANCELLED" },
      });
    }
    return { ok: true };
  });
}
