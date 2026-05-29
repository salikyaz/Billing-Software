import type {
  InvoiceStatus,
  NotificationType,
  EmailStatus,
} from "@prisma/client";

/**
 * API response shapes. Money fields arrive as STRINGS (Prisma Decimal
 * serialized to JSON). Always wrap with `toNumber()` before math/formatting.
 * Date fields also arrive as ISO strings over JSON.
 */

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  address: string | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientWithTotal extends Client {
  totalBilled: string | number;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: string;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientService {
  id: string;
  clientId: string;
  serviceId: string;
  quantity: number;
  customPrice: string | null;
  createdAt: string;
  service: Service;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
  service?: Service | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  status: InvoiceStatus;
  subtotal: string;
  taxRate: string;
  tax: string;
  total: string;
  currency: string;
  notes: string | null;
  dueDate: string;
  sentAt: string | null;
  paidAt: string | null;
  reminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  stripePaymentLinkId: string | null;
  stripePaymentLinkUrl: string | null;
  stripePaymentIntentId: string | null;
}

export interface InvoiceWithClient extends Invoice {
  client: Client;
}

export interface EmailLog {
  id: string;
  invoiceId: string | null;
  recipientEmail: string;
  subject: string;
  status: EmailStatus;
  errorMessage: string | null;
  sentAt: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  invoiceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface InvoiceDetail extends InvoiceWithClient {
  items: InvoiceItem[];
  emailLogs: EmailLog[];
  notifications: AppNotification[];
}

export interface ClientDetail extends Client {
  invoices: (Invoice & { items: InvoiceItem[] })[];
  clientServices: ClientService[];
}

export interface DashboardStats {
  totalRevenueThisMonth: number;
  paidThisMonthCount: number;
  pendingCount: number;
  pendingAmount: number;
  overdueCount: number;
  overdueAmount: number;
  revenueByMonth: { month: string; total: number }[];
  recentInvoices: InvoiceWithClient[];
}

export interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}

export interface Settings {
  id: string;
  companyName: string;
  companyEmail: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  logoUrl: string | null;
  taxRate: string;
  defaultCurrency: string;
  billingDay: number;
  reminderAfterDays: number;
  invoiceNumberPrefix: string;
  msClientId: string | null;
  msTenantId: string | null;
  msClientSecret: string;
  sharedMailbox: string | null;
  stripeSecretKey: string;
  stripePublishableKey: string | null;
  updatedAt: string;
  configured: {
    stripe: boolean;
    graph: boolean;
  };
}
