import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Generate the next sequential invoice number, e.g. INV-2024-0001.
 * Pass a transaction client when generating inside a transaction so the
 * count is consistent.
 */
export async function generateInvoiceNumber(
  prefix = "INV",
  tx: Prisma.TransactionClient = prisma
): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;

  // Find the highest existing number for this year/prefix.
  const last = await tx.invoice.findFirst({
    where: { invoiceNumber: { startsWith: yearPrefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let next = 1;
  if (last) {
    const parts = last.invoiceNumber.split("-");
    const seq = parseInt(parts[parts.length - 1] ?? "0", 10);
    if (!Number.isNaN(seq)) next = seq + 1;
  }

  return `${yearPrefix}${String(next).padStart(4, "0")}`;
}
