import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripeSecretKey } from "@/lib/settings";
import { toNumber } from "@/lib/utils";

// Cache Stripe instances keyed by the secret used to create them, so a
// settings change (different key) transparently produces a fresh client.
let cachedKey: string | null = null;
let cachedStripe: Stripe | null = null;

const STRIPE_API_VERSION = "2024-11-20.acacia";

/** Resolve a configured Stripe client. Throws if no secret key is set. */
export async function getStripe(): Promise<Stripe> {
  const key = await getStripeSecretKey();
  if (!key) {
    throw new Error(
      "Stripe is not configured: no secret key found in settings or STRIPE_SECRET_KEY."
    );
  }
  if (cachedStripe && cachedKey === key) return cachedStripe;

  cachedStripe = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
  });
  cachedKey = key;
  return cachedStripe;
}

/**
 * Ensure the invoice has a Stripe Payment Link. Returns existing link if one
 * is already persisted, otherwise creates a Product + Price for the invoice
 * total and a Payment Link, persisting the result on the invoice.
 */
export async function ensurePaymentLink(
  invoiceId: string
): Promise<{ id: string; url: string }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true, items: true },
  });
  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found.`);
  }

  if (invoice.stripePaymentLinkId && invoice.stripePaymentLinkUrl) {
    return { id: invoice.stripePaymentLinkId, url: invoice.stripePaymentLinkUrl };
  }

  try {
    const stripe = await getStripe();

    const total = toNumber(invoice.total);
    const unitAmount = Math.round(total * 100);
    if (unitAmount <= 0) {
      throw new Error(
        `Invoice ${invoice.invoiceNumber} total must be greater than zero to create a payment link.`
      );
    }

    const product = await stripe.products.create({
      name: `Invoice ${invoice.invoiceNumber}`,
      metadata: { invoiceId },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount,
      currency: invoice.currency.toLowerCase(),
    });

    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { invoiceId },
      payment_intent_data: { metadata: { invoiceId } },
      after_completion: { type: "hosted_confirmation" },
    });

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        stripePaymentLinkId: link.id,
        stripePaymentLinkUrl: link.url,
      },
    });

    return { id: link.id, url: link.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to create Stripe payment link for invoice ${invoice.invoiceNumber}: ${message}`
    );
  }
}

/** Verify and parse a Stripe webhook event from the raw request body. */
export async function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event> {
  const stripe = await getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
