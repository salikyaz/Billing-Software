import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleRoute, requireAdmin } from "@/lib/api";
import { generateInvoicePdf } from "@/lib/pdf/invoice";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return handleRoute(async () => {
    await requireAdmin();

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { invoiceNumber: true },
    });
    if (!invoice) throw new ApiError("Invoice not found", 404);

    const pdf = await generateInvoicePdf(params.id);

    // Convert Node Buffer to a Uint8Array so it satisfies the BodyInit type.
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  });
}
