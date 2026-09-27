import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import type { Bill, Charge, Discount, Payment, PaymentSettings, Profile } from "@/lib/database.types";
import { CHARGE_KIND_LABELS, CONVENIENCE_FEE_LABEL, PLATFORM_FEE_BPS, billTotal, formatMoney } from "@/lib/payments";
import {
  DiscountRowActions,
  FeeModePicker,
  NewChargeForm,
  NewDiscountForm,
  StripeConnectButton,
} from "./ManageControls";

// The treasurer's view: Stripe setup, card-fee default, charges with how
// much is in, and discount rules.
export default async function ManagePaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: meData } = await supabase
    .from("profiles")
    .select("role, is_treasurer")
    .eq("id", user?.id ?? "")
    .single();
  const me = meData as Pick<Profile, "role" | "is_treasurer"> | null;
  if (me?.role !== "admin" && !me?.is_treasurer) notFound();

  let { data: settingsRow } = await supabase.from("payment_settings").select("*").single();
  let settings = settingsRow as PaymentSettings;

  // Back from Stripe's sign-up (or still finishing it): check whether the
  // account can take payments yet.
  const stripe = getStripe();
  if (stripe && settings.stripe_account_id && !settings.stripe_charges_enabled) {
    try {
      const account = await stripe.accounts.retrieve(settings.stripe_account_id);
      if (account.charges_enabled) {
        const admin = createAdminClient();
        await admin.from("payment_settings").update({ stripe_charges_enabled: true }).eq("id", true);
        ({ data: settingsRow } = await supabase.from("payment_settings").select("*").single());
        settings = settingsRow as PaymentSettings;
      }
    } catch {
      // Stripe unreachable; show the last known status.
    }
  }

  const [{ data: chargeRows }, { data: billRows }, { data: paymentRows }, { data: discountRows }, { data: rowerRows }] =
    await Promise.all([
      supabase.from("charges").select("*").order("created_at", { ascending: false }),
      supabase.from("bills").select("*"),
      supabase.from("payments").select("bill_id, amount_cents, status"),
      supabase.from("discounts").select("*").order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, display_name")
        .in("role", ["rower", "coxswain"])
        .is("disabled_at", null)
        .order("display_name", { ascending: true }),
    ]);
  const charges = (chargeRows as Charge[] | null) ?? [];
  const bills = (billRows as Bill[] | null) ?? [];
  const payments = (paymentRows as Pick<Payment, "bill_id" | "amount_cents" | "status">[] | null) ?? [];
  const discounts = (discountRows as Discount[] | null) ?? [];
  const rowers = (rowerRows as Pick<Profile, "id" | "display_name">[] | null) ?? [];
  const chargeTitle = new Map(charges.map((c) => [c.id, c.title]));
  const rowerName = new Map(rowers.map((r) => [r.id, r.display_name]));

  function chargeSummary(chargeId: string) {
    const chargeBills = bills.filter((b) => b.charge_id === chargeId && b.status !== "cancelled");
    const billIds = new Set(chargeBills.map((b) => b.id));
    const collected = payments
      .filter((p) => p.status === "succeeded" && p.bill_id && billIds.has(p.bill_id))
      .reduce((s, p) => s + p.amount_cents, 0);
    const expected = chargeBills.filter((b) => b.status !== "waived").reduce((s, b) => s + billTotal(b), 0);
    return {
      count: chargeBills.length,
      paid: chargeBills.filter((b) => b.status === "paid" || b.status === "waived").length,
      collected,
      expected,
    };
  }

  const active = charges.filter((c) => !c.archived_at);
  const archived = charges.filter((c) => c.archived_at);

  function ChargeRow({ charge }: { charge: Charge }) {
    const s = chargeSummary(charge.id);
    return (
      <Link
        href={`/payments/manage/${charge.id}`}
        className="flex items-center justify-between gap-3 rounded-lg border-2 border-gray-200 px-4 py-3 hover:border-[var(--color-primary)]"
      >
        <div className="min-w-0">
          <p className="font-medium truncate">
            {charge.title}{" "}
            {charge.signup_open && (
              <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Sign-up open</span>
            )}
          </p>
          <p className="text-xs text-gray-500">
            {CHARGE_KIND_LABELS[charge.kind]} · {formatMoney(charge.amount_cents)}
            {charge.allow_installments && ` · ${charge.installment_count} payments allowed`}
          </p>
        </div>
        <div className="text-right text-sm shrink-0">
          <p className="font-semibold">
            {formatMoney(s.collected)} <span className="font-normal text-gray-500">of {formatMoney(s.expected)}</span>
          </p>
          <p className="text-xs text-gray-500">
            {s.paid}/{s.count} paid
          </p>
        </div>
      </Link>
    );
  }

  const stripeConfigured = !!stripe;
  return (
    <div className="min-h-screen p-8 max-w-2xl flex flex-col gap-8">
      <div>
        <Link href="/payments" className="text-sm text-gray-500 hover:underline">
          ← Payments
        </Link>
        <h1 className="text-2xl font-bold mt-4">Manage payments</h1>
      </div>

      <section className="rounded-lg border-2 border-[var(--color-primary)] p-4 flex flex-col gap-3">
        <h2 className="font-semibold">Online payments</h2>
        {!stripeConfigured ? (
          <p className="text-sm text-gray-600">
            Card payments aren&apos;t turned on for BoathouseOS yet. You can still bill rowers and record cash and
            check payments below.
          </p>
        ) : settings.stripe_charges_enabled ? (
          <p className="text-sm text-green-700 font-medium">
            ✓ Your club&apos;s Stripe account is connected. Families can pay by card, and payments go straight to
            the club.
          </p>
        ) : settings.stripe_account_id ? (
          <>
            <p className="text-sm text-gray-600">Stripe still needs a few details before the club can take cards.</p>
            <StripeConnectButton label="Finish Stripe setup" />
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Connect the club&apos;s own Stripe account so families can pay by card. Money goes straight to the
              club&apos;s bank account.
            </p>
            <StripeConnectButton label="Connect Stripe" />
          </>
        )}
        <div className="flex flex-col gap-1.5 pt-2 border-t">
          <p className="text-sm font-medium">Card processing fees (about 2.9% + 30¢)</p>
          <FeeModePicker value={settings.default_fee_mode} />
          <p className="text-xs text-gray-500">
            The default for new charges; each charge can override it. Families also pay a {PLATFORM_FEE_BPS / 100}%{" "}
            {CONVENIENCE_FEE_LABEL.toLowerCase()} on card payments.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Charges</h2>
          <Link href="/payments/manage/export" prefetch={false} className="text-sm text-gray-600 underline">
            Export all to CSV
          </Link>
        </div>
        <NewChargeForm />
        {active.length === 0 && <p className="text-sm text-gray-500">No charges yet.</p>}
        {active.map((c) => (
          <ChargeRow key={c.id} charge={c} />
        ))}
        {archived.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-gray-500">Archived ({archived.length})</summary>
            <div className="mt-2 flex flex-col gap-2">
              {archived.map((c) => (
                <ChargeRow key={c.id} charge={c} />
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Discounts</h2>
        {discounts.map((d) => (
          <div
            key={d.id}
            className={`flex items-center justify-between gap-3 rounded-lg border-2 px-4 py-2 text-sm ${
              d.active ? "border-gray-200" : "border-gray-100 text-gray-400"
            }`}
          >
            <div className="min-w-0">
              <p className="font-medium">
                {d.name}:{" "}
                {d.kind === "percent" ? `${(d.percent_bps ?? 0) / 100}% off` : `${formatMoney(d.amount_cents ?? 0)} off`}
              </p>
              <p className="text-xs text-gray-500">
                {d.charge_id ? `Only ${chargeTitle.get(d.charge_id) ?? "one charge"}` : "Any charge"} ·{" "}
                {d.profile_id ? `only ${rowerName.get(d.profile_id) ?? "one rower"}` : "every rower"}
                {d.expires_on && ` · until ${new Date(`${d.expires_on}T12:00:00`).toLocaleDateString()}`}
                {!d.active && " · off"}
              </p>
            </div>
            <DiscountRowActions id={d.id} active={d.active} />
          </div>
        ))}
        <NewDiscountForm charges={active.map((c) => ({ id: c.id, title: c.title }))} rowers={rowers} />
      </section>
    </div>
  );
}
