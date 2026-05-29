import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  currency: z.string().default("USD"),
  isActive: z.boolean().default(true),
});
export type ClientInput = z.infer<typeof clientSchema>;

export const serviceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  defaultPrice: z.coerce.number().nonnegative("Price must be >= 0"),
  unit: z.string().default("monthly"),
  isActive: z.boolean().default(true),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

export const invoiceItemSchema = z.object({
  serviceId: z.string().optional().nullable(),
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().int().positive().default(1),
  unitPrice: z.coerce.number().nonnegative(),
});

export const invoiceSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  items: z.array(invoiceItemSchema).min(1, "At least one line item is required"),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  dueDate: z.string().or(z.date()).optional(),
  notes: z.string().optional().nullable(),
  currency: z.string().optional(),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const clientServiceSchema = z.object({
  serviceId: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
  customPrice: z.coerce.number().nonnegative().optional().nullable(),
});

export const settingsSchema = z.object({
  companyName: z.string().min(1).optional(),
  companyEmail: z.string().email().optional().nullable().or(z.literal("")),
  companyAddress: z.string().optional().nullable(),
  companyPhone: z.string().optional().nullable(),
  logoUrl: z
    .string()
    .refine(
      (v) => v === "" || v.startsWith("/") || /^https:\/\//i.test(v),
      "Logo URL must be a root-relative path or an https:// URL"
    )
    .optional()
    .nullable(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  defaultCurrency: z.string().optional(),
  billingDay: z.coerce.number().int().min(1).max(28).optional(),
  reminderAfterDays: z.coerce.number().int().min(0).max(365).optional(),
  invoiceNumberPrefix: z.string().optional(),
  msClientId: z.string().optional().nullable(),
  msTenantId: z.string().optional().nullable(),
  sharedMailbox: z.string().optional().nullable().or(z.literal("")),
  stripePublishableKey: z.string().optional().nullable(),
  twoFactorEnabled: z.boolean().optional(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  code: z.string().optional(),
});

export const twoFactorRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
