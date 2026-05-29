import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  createNotification,
  logEmail,
} from "@/lib/notifications";
import { ensurePaymentLink } from "@/lib/stripe";
import { generateInvoicePdf } from "@/lib/pdf/invoice";
import { sendMailViaGraph } from "@/lib/email/graph";
import {
  invoiceEmailHtml,
  invoiceEmailSubject,
  passwordResetHtml,
  passwordResetSubject,
  paymentReceivedHtml,
  paymentReceivedSubject,
  reminderHtml,
  reminderSubject,
} from "@/lib/email/templates";
import { EmailStatus, InvoiceStatus, NotificationType } from "@prisma/client";

type InvoiceWithRelations = NonNullable<
  Awaited<ReturnType<typeof loadInvoice>>
>;

async function loadInvoice(invoiceId: string) {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true, items: true },
  });
}

async function buildPdfAttachment(invoiceId: string, invoiceNumber: string) {
  const pdf = await generateInvoicePdf(invoiceId);
  return {
    filename: `${invoiceNumber}.pdf`,
    contentBytes: pdf.toString("base64"),
    contentType: "application/pdf",
  };
}

/**
 * Send the invoice to the client: ensures a payment link + PDF, emails it
 * from the shared mailbox, then (only on success) marks SENT and notifies.
 */
export async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  const invoice = await loadInvoice(invoiceId);
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found.`);

  const settings = await getSettings();
  const { url } = await ensurePaymentLink(invoiceId);
  const attachment = await buildPdfAttachment(invoiceId, invoice.invoiceNumber);

  const subject = invoiceEmailSubject({
    companyName: settings.companyName,
    invoiceNumber: invoice.invoiceNumber,
    dueDate: invoice.dueDate,
  });

  const html = invoiceEmailHtml({
    companyName: settings.companyName,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client.name,
    total: invoice.total,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    items: invoice.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.total,
    })),
    paymentUrl: url,
    notes: invoice.notes,
  });

  try {
    await sendMailViaGraph({
      to: invoice.client.email,
      subject,
      html,
      attachments: [attachment],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEmail({
      invoiceId,
      recipientEmail: invoice.client.email,
      subject,
      status: EmailStatus.FAILED,
      errorMessage: message,
    });
    throw new Error(
      `Failed to send invoice ${invoice.invoiceNumber}: ${message}`
    );
  }

  await logEmail({
    invoiceId,
    recipientEmail: invoice.client.email,
    subject,
    status: EmailStatus.SUCCESS,
  });

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status:
          invoice.status === InvoiceStatus.DRAFT
            ? InvoiceStatus.SENT
            : invoice.status,
        sentAt: invoice.sentAt ?? new Date(),
      },
    });
    await createNotification(
      NotificationType.INVOICE_SENT,
      `Invoice ${invoice.invoiceNumber} sent to ${invoice.client.email}`,
      invoiceId,
      tx
    );
  });
}

/**
 * Send an overdue reminder. Sets reminderSentAt + notification on success.
 * Does NOT alter invoice status (the caller/cron manages OVERDUE).
 */
export async function sendReminderEmail(invoiceId: string): Promise<void> {
  const invoice = await loadInvoice(invoiceId);
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found.`);

  const settings = await getSettings();
  const { url } = await ensurePaymentLink(invoiceId);

  const subject = reminderSubject(invoice.invoiceNumber);
  const html = reminderHtml({
    companyName: settings.companyName,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client.name,
    total: invoice.total,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    paymentUrl: url,
  });

  try {
    await sendMailViaGraph({ to: invoice.client.email, subject, html });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEmail({
      invoiceId,
      recipientEmail: invoice.client.email,
      subject,
      status: EmailStatus.FAILED,
      errorMessage: message,
    });
    throw new Error(
      `Failed to send reminder for invoice ${invoice.invoiceNumber}: ${message}`
    );
  }

  await logEmail({
    invoiceId,
    recipientEmail: invoice.client.email,
    subject,
    status: EmailStatus.SUCCESS,
  });

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { reminderSentAt: new Date() },
    });
    await createNotification(
      NotificationType.REMINDER_SENT,
      `Reminder sent for invoice ${invoice.invoiceNumber} to ${invoice.client.email}`,
      invoiceId,
      tx
    );
  });
}

/**
 * Send a payment confirmation. The PAYMENT_RECEIVED notification is created
 * by the caller (webhook), so it is not duplicated here.
 */
export async function sendPaymentConfirmation(invoiceId: string): Promise<void> {
  const invoice = await loadInvoice(invoiceId);
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found.`);

  const settings = await getSettings();
  const subject = paymentReceivedSubject(invoice.invoiceNumber);
  const html = paymentReceivedHtml({
    companyName: settings.companyName,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client.name,
    total: invoice.total,
    currency: invoice.currency,
    paidAt: invoice.paidAt ?? new Date(),
  });

  try {
    await sendMailViaGraph({ to: invoice.client.email, subject, html });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEmail({
      invoiceId,
      recipientEmail: invoice.client.email,
      subject,
      status: EmailStatus.FAILED,
      errorMessage: message,
    });
    throw new Error(
      `Failed to send payment confirmation for invoice ${invoice.invoiceNumber}: ${message}`
    );
  }

  await logEmail({
    invoiceId,
    recipientEmail: invoice.client.email,
    subject,
    status: EmailStatus.SUCCESS,
  });
}

/**
 * Send an admin password-reset email (not tied to an invoice).
 * Logs the attempt in EmailLog and rethrows on failure.
 */
export async function sendPasswordResetEmail(opts: {
  email: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Promise<void> {
  const settings = await getSettings();
  const subject = passwordResetSubject(settings.companyName);
  const html = passwordResetHtml({
    companyName: settings.companyName,
    name: opts.name,
    resetUrl: opts.resetUrl,
    expiresInMinutes: opts.expiresInMinutes,
  });

  try {
    await sendMailViaGraph({ to: opts.email, subject, html });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEmail({
      recipientEmail: opts.email,
      subject,
      status: EmailStatus.FAILED,
      errorMessage: message,
    });
    throw new Error(`Failed to send password reset email: ${message}`);
  }

  await logEmail({
    recipientEmail: opts.email,
    subject,
    status: EmailStatus.SUCCESS,
  });
}

// Re-export for callers that want the raw type.
export type { InvoiceWithRelations };
