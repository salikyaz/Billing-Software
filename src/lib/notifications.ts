import { prisma } from "@/lib/prisma";
import type { NotificationType, Prisma, EmailStatus } from "@prisma/client";

/** Create an in-app notification. */
export async function createNotification(
  type: NotificationType,
  message: string,
  invoiceId?: string | null,
  tx: Prisma.TransactionClient = prisma
) {
  return tx.notification.create({
    data: { type, message, invoiceId: invoiceId ?? null },
  });
}

/** Record an email send attempt in the EmailLog table. */
export async function logEmail(params: {
  invoiceId?: string | null;
  recipientEmail: string;
  subject: string;
  status: EmailStatus;
  errorMessage?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx ?? prisma;
  return client.emailLog.create({
    data: {
      invoiceId: params.invoiceId ?? null,
      recipientEmail: params.recipientEmail,
      subject: params.subject,
      status: params.status,
      errorMessage: params.errorMessage ?? null,
    },
  });
}
