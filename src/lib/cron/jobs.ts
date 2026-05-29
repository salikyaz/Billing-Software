import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { computeInvoiceTotals, type LineItemInput } from "@/lib/invoice-calc";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { createNotification } from "@/lib/notifications";
import { sendInvoiceEmail, sendReminderEmail } from "@/lib/email/send";
import { addDays, toNumber } from "@/lib/utils";
import { InvoiceStatus, NotificationType } from "@prisma/client";

export interface MonthlyBillingResult {
  created: number;
  sent: number;
  errors: string[];
}

export interface OverdueCheckResult {
  overdue: number;
  reminders: number;
  errors: string[];
}

/**
 * Generate and send monthly invoices for every active client that has
 * recurring services assigned. One invoice per client.
 */
export async function runMonthlyBilling(): Promise<MonthlyBillingResult> {
  const settings = await getSettings();
  const taxRate = toNumber(settings.taxRate);
  const dueDays = settings.reminderAfterDays || 7;

  const result: MonthlyBillingResult = { created: 0, sent: 0, errors: [] };

  const clients = await prisma.client.findMany({
    where: { isActive: true },
    include: { clientServices: { include: { service: true } } },
  });

  for (const client of clients) {
    if (!client.clientServices.length) continue;

    try {
      const items: LineItemInput[] = client.clientServices.map((cs) => ({
        description: cs.service.name,
        quantity: cs.quantity,
        unitPrice: toNumber(cs.customPrice ?? cs.service.defaultPrice),
        serviceId: cs.serviceId,
      }));

      const totals = computeInvoiceTotals(items, taxRate);

      const invoice = await prisma.$transaction(async (tx) => {
        const invoiceNumber = await generateInvoiceNumber(
          settings.invoiceNumberPrefix,
          tx
        );
        return tx.invoice.create({
          data: {
            invoiceNumber,
            clientId: client.id,
            status: InvoiceStatus.DRAFT,
            currency: client.currency,
            subtotal: totals.subtotal,
            taxRate: totals.taxRate,
            tax: totals.tax,
            total: totals.total,
            dueDate: addDays(new Date(), dueDays),
            items: {
              create: totals.items.map((i) => ({
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                total: i.total,
                serviceId: i.serviceId ?? null,
              })),
            },
          },
        });
      });

      result.created += 1;

      try {
        await sendInvoiceEmail(invoice.id);
        result.sent += 1;
      } catch (sendErr) {
        const message =
          sendErr instanceof Error ? sendErr.message : String(sendErr);
        result.errors.push(
          `Invoice ${invoice.invoiceNumber} created but send failed: ${message}`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Client ${client.name} (${client.id}): ${message}`);
    }
  }

  return result;
}

/**
 * Mark sent invoices past their due date (beyond the reminder threshold) as
 * OVERDUE and send a reminder email to each.
 */
export async function runOverdueCheck(): Promise<OverdueCheckResult> {
  const settings = await getSettings();
  const thresholdDays = settings.reminderAfterDays || 7;
  const cutoff = addDays(new Date(), -thresholdDays);

  const result: OverdueCheckResult = { overdue: 0, reminders: 0, errors: [] };

  const invoices = await prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.SENT,
      dueDate: { lt: cutoff },
      reminderSentAt: null,
    },
    select: { id: true, invoiceNumber: true },
  });

  for (const invoice of invoices) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.OVERDUE },
        });
        await createNotification(
          NotificationType.PAYMENT_OVERDUE,
          `Invoice ${invoice.invoiceNumber} is overdue`,
          invoice.id,
          tx
        );
      });
      result.overdue += 1;

      try {
        await sendReminderEmail(invoice.id);
        result.reminders += 1;
      } catch (sendErr) {
        const message =
          sendErr instanceof Error ? sendErr.message : String(sendErr);
        result.errors.push(
          `Invoice ${invoice.invoiceNumber} marked overdue but reminder failed: ${message}`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Invoice ${invoice.invoiceNumber}: ${message}`);
    }
  }

  return result;
}
