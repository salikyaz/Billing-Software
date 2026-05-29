import type { Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleRoute, requireAdmin } from "@/lib/api";
import { settingsSchema } from "@/lib/validators";
import { getSettings, SETTINGS_ID } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Mask secrets and report which integrations are configured. */
function maskSettings(s: Settings) {
  const stripeConfigured = Boolean(
    s.stripeSecretKey || process.env.STRIPE_SECRET_KEY
  );
  const graphConfigured = Boolean(
    (s.msClientSecret || process.env.MICROSOFT_CLIENT_SECRET) &&
      (s.msClientId || process.env.MICROSOFT_CLIENT_ID) &&
      (s.msTenantId || process.env.MICROSOFT_TENANT_ID)
  );

  return {
    ...s,
    msClientSecret: "",
    stripeSecretKey: "",
    configured: {
      stripe: stripeConfigured,
      graph: graphConfigured,
    },
  };
}

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const s = await getSettings();
    return maskSettings(s);
  });
}

const SECRET_FIELDS = [
  "msClientSecret",
  "stripeSecretKey",
  "msClientId",
  "msTenantId",
  "stripePublishableKey",
  "sharedMailbox",
] as const;

export async function PUT(req: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const data = settingsSchema.partial().parse(await req.json());

    // Build the update payload, skipping secret fields left blank so we
    // never wipe existing stored secrets.
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if ((SECRET_FIELDS as readonly string[]).includes(key)) {
        if (typeof value === "string" && value.length > 0) {
          payload[key] = value;
        }
        continue;
      }
      payload[key] = value;
    }

    // Ensure the row exists first (getSettings lazily creates it).
    await getSettings();

    const updated = await prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...payload },
      update: payload,
    });

    return maskSettings(updated);
  });
}
