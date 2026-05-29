import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { constructWebhookEvent } from "@/lib/stripe";
import { createNotification } from "@/lib/notifications";
import { sendPaymentConfirmation } from "@/lib/email/send";
import { InvoiceStatus, NotificationType } from "@prisma/client";

export const dynamic = "force-dynamic";

async function markInvoicePaid(
  invoiceId: string,
  paymentIntentId: string | null
): Promise<boolean> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, status: true, invoiceNumber: true },
  });
  if (!invoice) {
    console.error(`[stripe-webhook] Invoice ${invoiceId} not found.`);
    return false;
  }
  if (invoice.status === InvoiceStatus.PAID) {
    return false; // already handled
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        ...(paymentIntentId
          ? { stripePaymentIntentId: paymentIntentId }
          : {}),
      },
    });
    await createNotification(
      NotificationType.PAYMENT_RECEIVED,
      `Payment received for invoice ${invoice.invoiceNumber}`,
      invoiceId,
      tx
    );
  });

  return true;
}

export async function POST(req: Request): Promise<NextResponse> {
  const signature = req.headers.get("stripe-signature");
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing stripe-signature header.");
    event = await constructWebhookEvent(payload, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoiceId;
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        if (invoiceId) {
          const changed = await markInvoicePaid(invoiceId, paymentIntentId);
          if (changed) {
            try {
              await sendPaymentConfirmation(invoiceId);
            } catch (e) {
              console.error(
                "[stripe-webhook] Payment confirmation email failed:",
                e instanceof Error ? e.message : e
              );
            }
          }
        } else {
          console.error(
            "[stripe-webhook] checkout.session.completed missing invoiceId metadata."
          );
        }
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = intent.metadata?.invoiceId;
        if (invoiceId) {
          const changed = await markInvoicePaid(invoiceId, intent.id);
          if (changed) {
            try {
              await sendPaymentConfirmation(invoiceId);
            } catch (e) {
              console.error(
                "[stripe-webhook] Payment confirmation email failed:",
                e instanceof Error ? e.message : e
              );
            }
          }
        } else {
          console.error(
            "[stripe-webhook] payment_intent.succeeded missing invoiceId metadata."
          );
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.error(
          "[stripe-webhook] payment_intent.payment_failed:",
          JSON.stringify({
            invoiceId: intent.metadata?.invoiceId ?? null,
            paymentIntentId: intent.id,
            lastError: intent.last_payment_error?.message ?? null,
          })
        );
        break;
      }

      default:
        // Unknown / unhandled event types are acknowledged, not errored.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    // Handled-path failure: log it but acknowledge so Stripe doesn't retry
    // forever on application bugs.
    console.error(
      "[stripe-webhook] Error handling event:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ received: true });
  }
}
