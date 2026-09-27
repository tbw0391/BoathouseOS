import "server-only";
import Stripe from "stripe";
import { headers } from "next/headers";

// Stripe is optional until the club connects an account: with no
// STRIPE_SECRET_KEY set, getStripe() is null and the payments pages fall
// back to tracking bills and cash/check payments only.
//
// Env (set in Vercel and .env.local, never in code):
//   STRIPE_SECRET_KEY      sk_test_... while testing, sk_live_... to go live
//   STRIPE_WEBHOOK_SECRET  whsec_... from the Connect webhook endpoint
//                          (https://<site>/api/stripe/webhook, "events on
//                          connected accounts")
let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

// This site's origin, for Stripe's return/success URLs.
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "boathouseos.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
