import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute, requireAdmin } from "@/lib/api";
import { sendReminderEmail } from "@/lib/email/send";
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
    if (invoice.status !== "SENT" && invoice.status !== "OVERDUE") {
      throw new ApiError(
        "Reminders can only be sent for sent or overdue invoices",
        409
      );
    }

    await assertSendReady();
    await sendReminderEmail(params.id);
    return { ok: true };
  });
}
