import type { Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleRoute, requireAdmin } from "@/lib/api";
import { settingsSchema } from "@/lib/validators";
import { getSettings, SETTINGS_ID } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Report which integrations are configured. Secrets themselves live ONLY in
 * environment variables (never the DB), so there is nothing secret to mask
 * here — we just surface booleans for the UI.
 */
function withConfigured(s: Settings) {
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const graphConfigured = Boolean(
    process.env.MICROSOFT_CLIENT_SECRET &&
      (s.msClientId || process.env.MICROSOFT_CLIENT_ID) &&
      (s.msTenantId || process.env.MICROSOFT_TENANT_ID) &&
      (s.sharedMailbox || process.env.SHARED_MAILBOX_ADDRESS)
  );

  return {
    ...s,
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
    return withConfigured(s);
  });
}

export async function PUT(req: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    // zod strips unknown keys, so secret fields (no longer in the schema)
    // can never be written to the DB even if a client sends them.
    const payload = settingsSchema.partial().parse(await req.json());

    await getSettings(); // ensure the singleton row exists

    const updated = await prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...payload },
      update: payload,
    });

    return withConfigured(updated);
  });
}
