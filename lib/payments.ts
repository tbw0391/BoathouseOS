// Money math shared by the payments pages, server actions and the Stripe
// webhook. Everything is integer cents.

import type { Bill, Charge, Discount, FeeMode, Payment } from "@/lib/database.types";

// BoathouseOS's convenience fee on each card payment to a club, in basis
// points (100 = 1%). Added on top for the payer as its own "Convenience fee"
// line, and collected by Stripe as the application fee, so the club still
// gets the full amount (less Stripe's card fee unless the payer covers it).
export const PLATFORM_FEE_BPS = 100;
export const CONVENIENCE_FEE_LABEL = "Convenience fee";

// Stripe's standard US card pricing, used to gross up a payment when the
// payer covers the card fee. (The club still sees Stripe's actual fee.)
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED_CENTS = 30;

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// "$12.50" / "12.5" / "12" -> 1250; null if it isn't a positive amount.
export function parseMoney(input: string): number | null {
  const n = Number(String(input).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

// What a payer adds so the club still nets `netCents` after Stripe's fee.
export function payerSurcharge(netCents: number): number {
  if (netCents <= 0) return 0;
  const gross = Math.ceil((netCents + STRIPE_FIXED_CENTS) / (1 - STRIPE_PERCENT));
  return gross - netCents;
}

// The convenience fee on a payment of `netCents`.
export function platformFee(netCents: number): number {
  return Math.round((netCents * PLATFORM_FEE_BPS) / 10000);
}

export function feeModeFor(charge: Pick<Charge, "fee_mode">, defaultFeeMode: FeeMode): FeeMode {
  return charge.fee_mode ?? defaultFeeMode;
}

function easternToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// The treasurer's discounts that apply to this rower on this charge today:
// active, not past their end date, and either for everyone or for this
// charge / this rower. They add up, capped at the charge amount.
export function applicableDiscount(
  amountCents: number,
  discounts: Discount[],
  chargeId: string,
  rowerId: string
): { discountCents: number; note: string | null } {
  const today = easternToday();
  const matching = discounts.filter(
    (d) =>
      d.active &&
      (!d.expires_on || d.expires_on >= today) &&
      (!d.charge_id || d.charge_id === chargeId) &&
      (!d.profile_id || d.profile_id === rowerId)
  );
  let total = 0;
  for (const d of matching) {
    total += d.kind === "percent" ? Math.round((amountCents * (d.percent_bps ?? 0)) / 10000) : d.amount_cents ?? 0;
  }
  return {
    discountCents: Math.min(total, amountCents),
    note: matching.length ? matching.map((d) => d.name).join(", ") : null,
  };
}

// Equal installments; any leftover cents go on the first one.
export function installmentAmounts(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const amounts = Array.from({ length: count }, () => base);
  amounts[0] += totalCents - base * count;
  return amounts;
}

export function billTotal(bill: Pick<Bill, "amount_cents" | "discount_cents">): number {
  return bill.amount_cents - bill.discount_cents;
}

export function amountPaid(payments: Pick<Payment, "amount_cents" | "status">[]): number {
  return payments.filter((p) => p.status === "succeeded").reduce((sum, p) => sum + p.amount_cents, 0);
}

export const CHARGE_KIND_LABELS: Record<Charge["kind"], string> = {
  season: "Season",
  dues: "Dues",
  regatta: "Regatta fee",
  travel: "Travel",
  apparel: "Apparel",
  other: "Other",
};

export const BILL_STATUS_LABELS: Record<Bill["status"], string> = {
  owed: "Owes",
  paid: "Paid",
  waived: "Waived",
  cancelled: "Cancelled",
};
