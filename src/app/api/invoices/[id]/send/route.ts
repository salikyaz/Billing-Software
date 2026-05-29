import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute, requireAdmin } from "@/lib/api";
import { sendInvoiceEmail } from "@/lib/email/send";
import { assertSendReady } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });
    if (!invoice) throw new ApiError("Invoice not found", 404);
    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      throw new ApiError(
        "Cannot send a paid or cancelled invoice",
        409
      );
    }

    await assertSendReady();
    await sendInvoiceEmail(params.id);
    return { ok: true };
  });
}
