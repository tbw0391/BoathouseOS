import "server-only";
import type Stripe from "stripe";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Bill, Charge, Discount, Order, OrderItem, Payment, PaymentSettings } from "@/lib/database.types";
import {
  PLATFORM_FEE_BPS,
  amountPaid,
  applicableDiscount,
  billTotal,
  feeModeFor,
  installmentAmounts,
  payerSurcharge,
  platformFee,
} from "@/lib/payments";

// Bill and order bookkeeping that has to run with the service role: creating
// bills with discounts applied, starting Stripe Checkout, and applying what
// Stripe reports back (lib/stripe.ts, app/api/stripe/webhook). Callers check
// who's allowed to do what before calling in here.

type Admin = ReturnType<typeof createAdminClient>;

export async function getPaymentSettings(admin: Admin): Promise<PaymentSettings> {
  const { data } = await admin.from("payment_settings").select("*").single();
  return data as PaymentSettings;
}

// Bills for rowers who don't have one for this charge yet, with the
// treasurer's discounts applied. Returns the new bills.
export async function createBills(
  admin: Admin,
  { charge, rowerIds, signedUpBy }: { charge: Charge; rowerIds: string[]; signedUpBy: string | null }
): Promise<Bill[]> {
  if (rowerIds.length === 0) return [];
  const [{ data: existing }, { data: discountRows }] = await Promise.all([
    admin.from("bills").select("rower_id").eq("charge_id", charge.id).in("rower_id", rowerIds),
    admin.from("discounts").select("*").eq("active", true),
  ]);
  const have = new Set(((existing as { rower_id: string }[] | null) ?? []).map((b) => b.rower_id));
  const discounts = (discountRows as Discount[] | null) ?? [];

  const rows = [...new Set(rowerIds)]
    .filter((id) => !have.has(id))
    .map((rowerId) => {
      const { discountCents, note } = applicableDiscount(charge.amount_cents, discounts, charge.id, rowerId);
      return {
        charge_id: charge.id,
        rower_id: rowerId,
        amount_cents: charge.amount_cents,
        discount_cents: discountCents,
        discount_note: note,
        status: discountCents >= charge.amount_cents ? "paid" : "owed",
        signed_up_by: signedUpBy,
      };
    });
  if (rows.length === 0) return [];
  const { data, error } = await admin.from("bills").insert(rows).select("*");
  if (error) throw new Error(error.message);
  return (data as Bill[] | null) ?? [];
}

async function paymentsFor(admin: Admin, billId: string): Promise<Payment[]> {
  const { data } = await admin.from("payments").select("*").eq("bill_id", billId);
  return (data as Payment[] | null) ?? [];
}

export async function billBalance(admin: Admin, bill: Bill): Promise<number> {
  return billTotal(bill) - amountPaid(await paymentsFor(admin, bill.id));
}

// Owed <-> paid from what's actually been paid. Waived/cancelled bills are
// the treasurer's call and are left alone.
export async function refreshBillStatus(admin: Admin, billId: string): Promise<void> {
  const { data } = await admin.from("bills").select("*").eq("id", billId).single();
  const bill = data as Bill | null;
  if (!bill || bill.status === "waived" || bill.status === "cancelled") return;
  const status = (await billBalance(admin, bill)) <= 0 ? "paid" : "owed";
  if (status !== bill.status) await admin.from("bills").update({ status }).eq("id", billId);
}

function lineItem(name: string, cents: number): Stripe.Checkout.SessionCreateParams.LineItem {
  return { quantity: 1, price_data: { currency: "usd", unit_amount: cents, product_data: { name } } };
}

// Stripe Checkout for what's left on a bill: paid in full now, or (when the
// charge allows it) as N equal automatic payments every K days. Runs on the
// club's connected account; BoathouseOS's fee comes off automatically.
export async function startBillCheckout(
  admin: Admin,
  stripe: Stripe,
  {
    bill,
    charge,
    rowerName,
    settings,
    plan,
    userId,
    origin,
  }: {
    bill: Bill;
    charge: Charge;
    rowerName: string;
    settings: PaymentSettings;
    plan: "full" | "installments";
    userId: string;
    origin: string;
  }
): Promise<string> {
  if (!settings.stripe_account_id || !settings.stripe_charges_enabled) {
    throw new Error("Online payments aren't set up yet. The treasurer can take cash or a check.");
  }
  if (bill.status !== "owed") throw new Error("This bill isn't open for payment.");
  const remaining = await billBalance(admin, bill);
  if (remaining <= 0) throw new Error("This bill is already paid.");

  const payerCovers = feeModeFor(charge, settings.default_fee_mode) === "payer";
  const name = `${charge.title} — ${rowerName}`;
  const returnUrl = `${origin}/payments`;
  const account = { stripeAccount: settings.stripe_account_id };

  if (plan === "full") {
    const surcharge = payerCovers ? payerSurcharge(remaining) : 0;
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [lineItem(name, remaining), ...(surcharge ? [lineItem("Card processing fee", surcharge)] : [])],
        payment_intent_data: { application_fee_amount: platformFee(remaining), metadata: { bill_id: bill.id } },
        metadata: { kind: "bill", bill_id: bill.id },
        success_url: `${returnUrl}?paid=1`,
        cancel_url: returnUrl,
      },
      account
    );
    await admin.from("payments").insert({
      bill_id: bill.id,
      amount_cents: remaining,
      surcharge_cents: surcharge,
      platform_fee_cents: platformFee(remaining),
      method: "card",
      status: "pending",
      stripe_checkout_session_id: session.id,
      paid_by: userId,
    });
    await admin.from("bills").update({ plan: "full" }).eq("id", bill.id);
    return session.url as string;
  }

  if (!charge.allow_installments) throw new Error("This charge can't be split into payments.");
  if (bill.stripe_subscription_id) throw new Error("This bill already has a payment plan.");
  const amounts = installmentAmounts(remaining, charge.installment_count);
  const base = amounts[amounts.length - 1];
  const firstExtra = amounts[0] - base;
  const baseSurcharge = payerCovers ? payerSurcharge(base) : 0;
  const firstGross = amounts[0] + (payerCovers ? payerSurcharge(amounts[0]) : 0);
  const firstExtraGross = firstGross - (base + baseSurcharge);

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: base + baseSurcharge,
            recurring: { interval: "day", interval_count: charge.installment_interval_days },
            product_data: {
              name: `${name} (${charge.installment_count} payments${payerCovers ? ", incl. card fee" : ""})`,
            },
          },
        },
        ...(firstExtraGross > 0 ? [lineItem("Rounding on first payment", firstExtraGross)] : []),
      ],
      subscription_data: {
        application_fee_percent: PLATFORM_FEE_BPS / 100,
        metadata: {
          bill_id: bill.id,
          installment_count: String(charge.installment_count),
          installment_interval_days: String(charge.installment_interval_days),
          installment_net: String(base),
          installment_surcharge: String(baseSurcharge),
          first_extra_net: String(firstExtra),
          first_extra_surcharge: String(firstExtraGross - firstExtra),
          paid_by: userId,
        },
      },
      metadata: { kind: "bill_installments", bill_id: bill.id },
      success_url: `${returnUrl}?paid=1`,
      cancel_url: returnUrl,
    },
    account
  );
  await admin.from("bills").update({ plan: "installments" }).eq("id", bill.id);
  return session.url as string;
}

// Stripe Checkout for an apparel order, on the club's connected account.
export async function startOrderCheckout(
  admin: Admin,
  stripe: Stripe,
  {
    order,
    items,
    productNames,
    settings,
    userId,
    origin,
  }: {
    order: Order;
    items: OrderItem[];
    productNames: Map<string, string>;
    settings: PaymentSettings;
    userId: string;
    origin: string;
  }
): Promise<string> {
  if (!settings.stripe_account_id || !settings.stripe_charges_enabled) {
    throw new Error("Online payments aren't set up yet.");
  }
  const surcharge = settings.default_fee_mode === "payer" ? payerSurcharge(order.total_cents) : 0;
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        ...items.map((i) => ({
          quantity: i.quantity,
          price_data: {
            currency: "usd",
            unit_amount: i.price_cents,
            product_data: { name: `${productNames.get(i.product_id) ?? "Item"}${i.size ? ` (${i.size})` : ""}` },
          },
        })),
        ...(surcharge ? [lineItem("Card processing fee", surcharge)] : []),
      ],
      payment_intent_data: { application_fee_amount: platformFee(order.total_cents), metadata: { order_id: order.id } },
      metadata: { kind: "order", order_id: order.id },
      success_url: `${origin}/apparel?paid=1`,
      cancel_url: `${origin}/apparel`,
    },
    { stripeAccount: settings.stripe_account_id }
  );
  await admin.from("payments").insert({
    order_id: order.id,
    amount_cents: order.total_cents,
    surcharge_cents: surcharge,
    platform_fee_cents: platformFee(order.total_cents),
    method: "card",
    status: "pending",
    stripe_checkout_session_id: session.id,
    paid_by: userId,
  });
  return session.url as string;
}

// --- What Stripe reports back (webhook) ---

async function markOrderPaid(admin: Admin, orderId: string) {
  const { data } = await admin.from("orders").select("*").eq("id", orderId).single();
  const order = data as Order | null;
  if (!order || order.status !== "pending") return;
  await admin.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId);

  // In-stock purchases come off the shelf once paid.
  if (!order.window_id) {
    const { data: itemRows } = await admin.from("order_items").select("*").eq("order_id", orderId);
    for (const item of (itemRows as OrderItem[] | null) ?? []) {
      const { data: stock } = await admin
        .from("product_stock")
        .select("quantity")
        .eq("product_id", item.product_id)
        .eq("size", item.size)
        .maybeSingle();
      if (stock) {
        await admin
          .from("product_stock")
          .update({ quantity: Math.max(0, (stock as { quantity: number }).quantity - item.quantity) })
          .eq("product_id", item.product_id)
          .eq("size", item.size);
      }
    }
  }
}

export async function handleCheckoutCompleted(
  admin: Admin,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  account: string | undefined
) {
  const kind = session.metadata?.kind;
  if (kind === "bill" || kind === "order") {
    if (session.payment_status !== "paid") return;
    await admin
      .from("payments")
      .update({
        status: "succeeded",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      })
      .eq("stripe_checkout_session_id", session.id);
    if (kind === "bill" && session.metadata?.bill_id) await refreshBillStatus(admin, session.metadata.bill_id);
    if (kind === "order" && session.metadata?.order_id) await markOrderPaid(admin, session.metadata.order_id);
    return;
  }

  if (kind === "bill_installments" && session.metadata?.bill_id && typeof session.subscription === "string") {
    // Stop after the last installment: cancel partway through the period
    // after it, so exactly N invoices are ever created.
    const sub = await stripe.subscriptions.retrieve(session.subscription, {}, { stripeAccount: account });
    const count = Number(sub.metadata.installment_count);
    const intervalDays = Number(sub.metadata.installment_interval_days);
    if (count && intervalDays) {
      const cancelAt = sub.billing_cycle_anchor + ((count - 1) * intervalDays + intervalDays / 2) * 86400;
      await stripe.subscriptions.update(
        sub.id,
        { cancel_at: Math.round(cancelAt), proration_behavior: "none" },
        { stripeAccount: account }
      );
    }
    await admin
      .from("bills")
      .update({
        plan: "installments",
        stripe_subscription_id: sub.id,
        stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      })
      .eq("id", session.metadata.bill_id);
  }
}

// Each installment of a payment plan (including the first).
export async function handleInvoicePaid(
  admin: Admin,
  stripe: Stripe,
  invoice: Stripe.Invoice,
  account: string | undefined
) {
  const meta = invoice.parent?.subscription_details?.metadata;
  const billId = meta?.bill_id;
  if (!billId || !invoice.id) return;

  const { count: already } = await admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("bill_id", billId)
    .eq("method", "card")
    .not("installment_number", "is", null);
  const n = (already ?? 0) + 1;
  const net = Number(meta.installment_net ?? 0) + (n === 1 ? Number(meta.first_extra_net ?? 0) : 0);
  const surcharge = Number(meta.installment_surcharge ?? 0) + (n === 1 ? Number(meta.first_extra_surcharge ?? 0) : 0);

  let paymentIntent: string | null = null;
  try {
    const full = await stripe.invoices.retrieve(invoice.id, { expand: ["payments"] }, { stripeAccount: account });
    const pi = full.payments?.data?.[0]?.payment?.payment_intent;
    paymentIntent = typeof pi === "string" ? pi : pi?.id ?? null;
  } catch {
    // Only needed to match a later refund.
  }

  const { error } = await admin.from("payments").insert({
    bill_id: billId,
    amount_cents: net,
    surcharge_cents: surcharge,
    platform_fee_cents: platformFee(net),
    method: "card",
    status: "succeeded",
    installment_number: n,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: paymentIntent,
    paid_by: meta.paid_by || null,
    paid_at: new Date().toISOString(),
  });
  // A retried webhook for the same invoice hits the unique invoice id.
  if (error && error.code !== "23505") throw new Error(error.message);
  await refreshBillStatus(admin, billId);
}

export async function handleChargeRefunded(admin: Admin, charge: Stripe.Charge) {
  if (!charge.refunded || typeof charge.payment_intent !== "string") return;
  const { data } = await admin
    .from("payments")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", charge.payment_intent)
    .select("bill_id, order_id");
  for (const p of (data as Pick<Payment, "bill_id" | "order_id">[] | null) ?? []) {
    if (p.bill_id) await refreshBillStatus(admin, p.bill_id);
    if (p.order_id) await admin.from("orders").update({ status: "cancelled" }).eq("id", p.order_id);
  }
}

export async function handleAccountUpdated(admin: Admin, account: Stripe.Account) {
  await admin
    .from("payment_settings")
    .update({ stripe_charges_enabled: account.charges_enabled })
    .eq("stripe_account_id", account.id);
}
