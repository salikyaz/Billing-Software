import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { DEFAULTS } from "@/lib/constants";
import type { Settings } from "@prisma/client";

export const SETTINGS_ID = "singleton";

/** Fetch (or lazily create) the singleton settings row. */
export async function getSettings(): Promise<Settings> {
  const existing = await prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) return existing;
  return prisma.settings.create({
    data: {
      id: SETTINGS_ID,
      companyName: process.env.COMPANY_NAME ?? "Aitek Solutions",
      logoUrl: "/logo.png",
      taxRate: DEFAULTS.TAX_RATE,
      billingDay: DEFAULTS.BILLING_DAY,
      reminderAfterDays: DEFAULTS.REMINDER_AFTER_DAYS,
      defaultCurrency: DEFAULTS.CURRENCY,
    },
  });
}

/**
 * Resolved Microsoft Graph credentials. DB settings take precedence,
 * falling back to environment variables.
 */
export async function getGraphConfig(settings?: Settings) {
  const s = settings ?? (await getSettings());
  return {
    clientId: s.msClientId ?? process.env.MICROSOFT_CLIENT_ID ?? "",
    tenantId: s.msTenantId ?? process.env.MICROSOFT_TENANT_ID ?? "",
    clientSecret: s.msClientSecret ?? process.env.MICROSOFT_CLIENT_SECRET ?? "",
    sharedMailbox:
      s.sharedMailbox ?? process.env.SHARED_MAILBOX_ADDRESS ?? "",
  };
}

/** Resolved Stripe secret key (DB first, then env). */
export async function getStripeSecretKey(settings?: Settings): Promise<string> {
  const s = settings ?? (await getSettings());
  return s.stripeSecretKey ?? process.env.STRIPE_SECRET_KEY ?? "";
}

export function getTaxRate(settings: Settings): number {
  return toNumber(settings.taxRate);
}

/**
 * Throw a clear 422 ApiError if the credentials required to send an invoice
 * (Stripe payment link + Microsoft Graph email) are not configured, rather
 * than letting the integration throw a generic 500 deeper in the stack.
 */
export async function assertSendReady(): Promise<void> {
  const settings = await getSettings();
  const stripeKey = await getStripeSecretKey(settings);
  const graph = await getGraphConfig(settings);

  const missing: string[] = [];
  if (!stripeKey) missing.push("Stripe secret key");
  if (!graph.clientId || !graph.tenantId || !graph.clientSecret) {
    missing.push("Microsoft Graph credentials");
  }
  if (!graph.sharedMailbox) missing.push("shared mailbox address");

  if (missing.length > 0) {
    // Imported lazily to avoid a settings -> api import cycle at module load.
    const { ApiError } = await import("@/lib/api");
    throw new ApiError(
      `Cannot send: ${missing.join(", ")} not configured. Add them in Settings.`,
      422
    );
  }
}
