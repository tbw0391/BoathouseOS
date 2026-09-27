import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  handleAccountUpdated,
  handleChargeRefunded,
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
} from "@/lib/billing";

// Stripe → BoathouseOS. Registered in Stripe as a Connect webhook ("events on
// connected accounts") pointing at /api/stripe/webhook, sending:
// checkout.session.completed, invoice.paid, invoice.payment_failed,
// charge.refunded, account.updated.
// Every event is verified with STRIPE_WEBHOOK_SECRET before anything is
// written, so nobody can fake a payment by calling this URL.
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Stripe isn't configured.", { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature.", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Bad signature.", { status: 400 });
  }

  const admin = createAdminClient();
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(admin, stripe, event.data.object, event.account);
        break;
      case "invoice.paid":
        await handleInvoicePaid(admin, stripe, event.data.object, event.account);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(admin, event.data.object);
        break;
      case "charge.refunded":
        await handleChargeRefunded(admin, event.data.object);
        break;
      case "account.updated":
        await handleAccountUpdated(admin, event.data.object);
        break;
    }
  } catch (e) {
    console.error("Stripe webhook failed:", event.type, event.id, e);
    // 500 makes Stripe retry later.
    return new Response("Webhook handler failed.", { status: 500 });
  }
  return new Response("ok");
}
