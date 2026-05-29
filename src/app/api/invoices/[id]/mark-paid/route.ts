import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute, requireAdmin } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { sendPaymentConfirmation } from "@/lib/email/send";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, invoiceNumber: true },
    });
    if (!invoice) throw new ApiError("Invoice not found", 404);
    if (invoice.status === "PAID") return { ok: true };

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: params.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      await createNotification(
        "PAYMENT_RECEIVED",
        `Payment received for invoice ${invoice.invoiceNumber}`,
        params.id,
        tx
      );
    });

    try {
      await sendPaymentConfirmation(params.id);
    } catch (err) {
      console.error("[mark-paid] payment confirmation email failed:", err);
    }

    return { ok: true };
  });
}
