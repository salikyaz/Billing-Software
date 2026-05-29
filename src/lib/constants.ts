import type { InvoiceStatus, NotificationType } from "@prisma/client";

/** Tailwind class sets for invoice status badges (dark theme). */
export const INVOICE_STATUS_STYLES: Record<
  InvoiceStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
  },
  SENT: {
    label: "Sent",
    className: "bg-primary/15 text-primary border-primary/30",
  },
  PAID: {
    label: "Paid",
    className: "bg-success/15 text-success border-success/30",
  },
  OVERDUE: {
    label: "Overdue",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground border-border line-through",
  },
};

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  INVOICE_SENT: "Invoice sent",
  PAYMENT_RECEIVED: "Payment received",
  PAYMENT_OVERDUE: "Payment overdue",
  REMINDER_SENT: "Reminder sent",
};

export const DEFAULTS = {
  DUE_DATE_DAYS: 7,
  REMINDER_AFTER_DAYS: 7,
  BILLING_DAY: 1,
  CURRENCY: "USD",
  TAX_RATE: 0,
} as const;

export const APP_NAME = "Aitek Billing";
