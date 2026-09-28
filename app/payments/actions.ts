"use server";

import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, siteOrigin } from "@/lib/stripe";
import { createBills, getPaymentSettings, refreshBillStatus, startBillCheckout } from "@/lib/billing";
import { parseMoney } from "@/lib/payments";
import type { Bill, Charge, FeeMode, Profile, Team } from "@/lib/database.types";

const CHARGE_KINDS: Charge["kind"][] = ["season", "dues", "regatta", "travel", "apparel", "other"];

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

// Admins and treasurers run payments.
async function requireTreasurer() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("role, is_treasurer").eq("id", user.id).single();
  const me = data as Pick<Profile, "role" | "is_treasurer"> | null;
  if (me?.role !== "admin" && !me?.is_treasurer) throw new Error("Only the treasurer or an admin can do that.");
  return { supabase, user };
}

function revalidatePayments() {
  revalidatePath("/payments", "layout");
  revalidatePath("/");
}

// --- Treasurer: charges ---

export async function createCharge(formData: FormData) {
  const { supabase, user } = await requireTreasurer();
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "dues") as Charge["kind"];
  const amount = parseMoney(String(formData.get("amount") ?? ""));
  if (!title) throw new Error("Give the charge a name.");
  if (!CHARGE_KINDS.includes(kind)) throw new Error("Pick what kind of charge this is.");
  if (!amount) throw new Error("Enter an amount, like 250 or 250.00.");

  const feeModeRaw = String(formData.get("fee_mode") ?? "");
  const installments = formData.get("allow_installments") === "on";
  const count = Number(formData.get("installment_count") ?? 4);
  const intervalDays = Number(formData.get("installment_interval_days") ?? 30);
  if (installments && !(count >= 2 && count <= 12)) throw new Error("Payments must be between 2 and 12.");
  if (installments && !(intervalDays >= 7 && intervalDays <= 120)) {
    throw new Error("Days between payments must be between 7 and 120.");
  }

  const { data, error } = await supabase
    .from("charges")
    .insert({
      title,
      kind,
      amount_cents: amount,
      description: String(formData.get("description") ?? "").trim() || null,
      due_date: String(formData.get("due_date") ?? "") || null,
      fee_mode: feeModeRaw === "club" || feeModeRaw === "payer" ? feeModeRaw : null,
      signup_open: formData.get("signup_open") === "on",
      allow_installments: installments,
      installment_count: installments ? count : 4,
      installment_interval_days: installments ? intervalDays : 30,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePayments();
  return { id: (data as { id: string }).id };
}

export async function setChargeSignupOpen(chargeId: string, open: boolean) {
  const { supabase } = await requireTreasurer();
  const { error } = await supabase.from("charges").update({ signup_open: open }).eq("id", chargeId);
  if (error) throw new Error(error.message);
  revalidatePayments();
}

export async function archiveCharge(chargeId: string, archived: boolean) {
  const { supabase } = await requireTreasurer();
  const { error } = await supabase
    .from("charges")
    .update({ archived_at: archived ? new Date().toISOString() : null, signup_open: false })
    .eq("id", chargeId);
  if (error) throw new Error(error.message);
  revalidatePayments();
}

// Bill a squad, the whole rowing roster, or picked rowers. Rowers already
// billed for this charge are skipped; discounts apply automatically.
export async function assignCharge(chargeId: string, target: { teams?: Team[]; rowerIds?: string[] }) {
  const { supabase, user } = await requireTreasurer();
  const { data: charge } = await supabase.from("charges").select("*").eq("id", chargeId).single();
  if (!charge) throw new Error("That charge couldn't be found.");

  let rowerIds = target.rowerIds ?? [];
  if (target.teams?.length) {
    const { data: teamRows } = await supabase.from("profile_teams").select("profile_id").in("team", target.teams);
    rowerIds = [...rowerIds, ...((teamRows as { profile_id: string }[] | null) ?? []).map((r) => r.profile_id)];
  }
  // Only active rowers and coxswains get bills.
  const { data: eligible } = await supabase
    .from("profiles")
    .select("id")
    .in("id", rowerIds.length ? rowerIds : ["00000000-0000-0000-0000-000000000000"])
    .in("role", ["rower", "coxswain"])
    .is("disabled_at", null);
  const ids = ((eligible as { id: string }[] | null) ?? []).map((p) => p.id);

  const created = await createBills(createAdminClient(), {
    charge: charge as Charge,
    rowerIds: ids,
    signedUpBy: user.id,
  });
  revalidatePayments();
  return { created: created.length, skipped: ids.length - created.length };
}

// --- Treasurer: individual bills ---

export async function setBillDiscount(billId: string, discountDollars: string, note: string) {
  const { supabase } = await requireTreasurer();
  const { data } = await supabase.from("bills").select("*").eq("id", billId).single();
  const bill = data as Bill | null;
  if (!bill) throw new Error("That bill couldn't be found.");
  const discount = discountDollars.trim() === "" || discountDollars.trim() === "0" ? 0 : parseMoney(discountDollars);
  if (discount === null) throw new Error("Enter the discount in dollars, like 50.");
  if (discount > bill.amount_cents) throw new Error("The discount can't be more than the charge.");

  const { error } = await supabase
    .from("bills")
    .update({ discount_cents: discount, discount_note: note.trim() || null })
    .eq("id", billId);
  if (error) throw new Error(error.message);
  await refreshBillStatus(createAdminClient(), billId);
  revalidatePayments();
}

export async function setBillStatus(billId: string, status: "owed" | "waived" | "cancelled") {
  const { supabase } = await requireTreasurer();
  const { error } = await supabase.from("bills").update({ status }).eq("id", billId);
  if (error) throw new Error(error.message);
  if (status === "owed") await refreshBillStatus(createAdminClient(), billId);
  revalidatePayments();
}

export async function recordManualPayment(formData: FormData) {
  const { supabase, user } = await requireTreasurer();
  const billId = String(formData.get("bill_id") ?? "");
  const method = String(formData.get("method") ?? "check");
  const amount = parseMoney(String(formData.get("amount") ?? ""));
  if (!billId) throw new Error("Missing bill.");
  if (!["cash", "check", "other"].includes(method)) throw new Error("Pick cash, check, or other.");
  if (!amount) throw new Error("Enter the amount received.");

  const { error } = await supabase.from("payments").insert({
    bill_id: billId,
    amount_cents: amount,
    method,
    status: "succeeded",
    note: String(formData.get("note") ?? "").trim() || null,
    recorded_by: user.id,
    paid_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  await refreshBillStatus(createAdminClient(), billId);
  revalidatePayments();
}

// --- Treasurer: discounts ---

export async function createDiscount(formData: FormData) {
  const { supabase, user } = await requireTreasurer();
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "percent");
  const value = String(formData.get("value") ?? "").trim();
  if (!name) throw new Error("Name the discount, like \"Sibling\" or \"Early bird\".");

  let percentBps: number | null = null;
  let amountCents: number | null = null;
  if (kind === "percent") {
    const pct = Number(value.replace("%", ""));
    if (!(pct > 0 && pct <= 100)) throw new Error("Enter a percent between 1 and 100.");
    percentBps = Math.round(pct * 100);
  } else if (kind === "amount") {
    amountCents = parseMoney(value);
    if (!amountCents) throw new Error("Enter a dollar amount, like 50.");
  } else {
    throw new Error("Pick percent or dollar amount.");
  }

  const { error } = await supabase.from("discounts").insert({
    name,
    kind,
    percent_bps: percentBps,
    amount_cents: amountCents,
    charge_id: String(formData.get("charge_id") ?? "") || null,
    profile_id: String(formData.get("profile_id") ?? "") || null,
    expires_on: String(formData.get("expires_on") ?? "") || null,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePayments();
}

export async function setDiscountActive(discountId: string, active: boolean) {
  const { supabase } = await requireTreasurer();
  const { error } = await supabase.from("discounts").update({ active }).eq("id", discountId);
  if (error) throw new Error(error.message);
  revalidatePayments();
}

export async function deleteDiscount(discountId: string) {
  const { supabase } = await requireTreasurer();
  const { error } = await supabase.from("discounts").delete().eq("id", discountId);
  if (error) throw new Error(error.message);
  revalidatePayments();
}

// --- Treasurer: settings and Stripe ---

export async function setDefaultFeeMode(mode: FeeMode) {
  const { supabase } = await requireTreasurer();
  if (mode !== "club" && mode !== "payer") throw new Error("Pick club or payer.");
  const { error } = await supabase.from("payment_settings").update({ default_fee_mode: mode }).eq("id", true);
  if (error) throw new Error(error.message);
  revalidatePayments();
}

// Starts (or resumes) Stripe's sign-up for the club's own Stripe account and
// returns the Stripe page to send the treasurer to. Stripe's own error comes
// back as { error } rather than thrown, since production hides thrown
// messages and Stripe's usually say exactly what to fix in its dashboard.
export async function connectStripe(): Promise<{ url: string } | { error: string }> {
  await requireTreasurer();
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe isn't set up for BoathouseOS yet (no Stripe key on the server)." };
  try {
    return { url: await startStripeOnboarding(stripe) };
  } catch (e) {
    console.error("connectStripe", e);
    return { error: e instanceof Error ? e.message : "Couldn't reach Stripe." };
  }
}

async function startStripeOnboarding(stripe: Stripe): Promise<string> {
  const admin = createAdminClient();
  const settings = await getPaymentSettings(admin);

  let accountId = settings.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      controller: {
        fees: { payer: "account" },
        losses: { payments: "stripe" },
        stripe_dashboard: { type: "full" },
      },
      country: "US",
    });
    accountId = account.id;
    await admin.from("payment_settings").update({ stripe_account_id: accountId }).eq("id", true);
  }

  const origin = await siteOrigin();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/payments/manage?stripe=refresh`,
    return_url: `${origin}/payments/manage?stripe=return`,
  });
  return link.url;
}

// Re-reads whether the club's Stripe account can take payments yet.
export async function refreshStripeStatus() {
  await requireTreasurer();
  const stripe = getStripe();
  const admin = createAdminClient();
  const settings = await getPaymentSettings(admin);
  if (!stripe || !settings.stripe_account_id) return;
  const account = await stripe.accounts.retrieve(settings.stripe_account_id);
  await admin
    .from("payment_settings")
    .update({ stripe_charges_enabled: account.charges_enabled })
    .eq("id", true);
  revalidatePayments();
}

// --- Members: sign up and pay ---

async function requireCanSeeRower(supabase: Awaited<ReturnType<typeof createClient>>, rowerId: string) {
  const { data: ok } = await supabase.rpc("can_see_rower", { rower: rowerId });
  if (ok !== true) throw new Error("You can only sign up or pay for yourself or your own rowers.");
}

// A family signs a rower up for an open season (or other open charge): the
// bill is created with the treasurer's discounts, then — when online
// payments are on — straight to Stripe to pay in full or start the plan.
// Returns the Stripe URL to go to, or null if the treasurer collects offline.
export async function signUpForCharge(
  chargeId: string,
  rowerId: string,
  plan: "full" | "installments"
): Promise<string | null> {
  const { supabase, user } = await requireUser();
  await requireCanSeeRower(supabase, rowerId);
  const admin = createAdminClient();

  const { data: chargeRow } = await admin.from("charges").select("*").eq("id", chargeId).single();
  const charge = chargeRow as Charge | null;
  if (!charge || !charge.signup_open || charge.archived_at) throw new Error("Sign-up for this isn't open.");
  if (plan === "installments" && !charge.allow_installments) throw new Error("This can't be split into payments.");

  await createBills(admin, { charge, rowerIds: [rowerId], signedUpBy: user.id });
  const { data: billRow } = await admin
    .from("bills")
    .select("*")
    .eq("charge_id", chargeId)
    .eq("rower_id", rowerId)
    .single();
  const bill = billRow as Bill;
  revalidatePayments();
  if (bill.status !== "owed") return null;
  return payBillInternal(bill, charge, plan, user.id);
}

export async function payBill(billId: string, plan: "full" | "installments"): Promise<string> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("bills").select("*").eq("id", billId).single();
  const bill = data as Bill | null;
  if (!bill) throw new Error("That bill couldn't be found.");
  await requireCanSeeRower(supabase, bill.rower_id);
  const { data: charge } = await supabase.from("charges").select("*").eq("id", bill.charge_id).single();
  const url = await payBillInternal(bill, charge as Charge, plan, user.id);
  if (!url) throw new Error("Online payments aren't set up yet. The treasurer can take cash or a check.");
  return url;
}

async function payBillInternal(bill: Bill, charge: Charge, plan: "full" | "installments", userId: string) {
  const stripe = getStripe();
  const admin = createAdminClient();
  const settings = await getPaymentSettings(admin);
  if (!stripe || !settings.stripe_account_id || !settings.stripe_charges_enabled) return null;

  const { data: rower } = await admin.from("profiles").select("display_name").eq("id", bill.rower_id).single();
  return startBillCheckout(admin, stripe, {
    bill,
    charge,
    rowerName: (rower as { display_name: string } | null)?.display_name ?? "Rower",
    settings,
    plan,
    userId,
    origin: await siteOrigin(),
  });
}
