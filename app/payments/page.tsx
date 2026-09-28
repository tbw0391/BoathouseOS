import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Bill, Charge, Discount, Payment, PaymentSettings, Profile } from "@/lib/database.types";
import {
  BILL_STATUS_LABELS,
  CONVENIENCE_FEE_LABEL,
  PLATFORM_FEE_BPS,
  amountPaid,
  applicableDiscount,
  billTotal,
  formatMoney,
  installmentAmounts,
} from "@/lib/payments";
import { PayButtons } from "./PayButtons";

// A family's payments: seasons open for sign-up, what each of their rowers
// owes (with Pay buttons), and what's been paid.
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const { paid } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: meData } = await supabase
    .from("profiles")
    .select("id, role, is_treasurer, spouse_id, display_name")
    .eq("id", user.id)
    .single();
  const me = meData as Pick<Profile, "id" | "role" | "is_treasurer" | "spouse_id" | "display_name">;
  const isTreasurer = me.role === "admin" || me.is_treasurer;

  // The rowers this person signs up and pays for: themselves if they row,
  // plus their household's linked rowers.
  const { data: spouseRows } = await supabase.from("profiles").select("id").eq("spouse_id", user.id);
  const householdIds = [
    user.id,
    ...(me.spouse_id ? [me.spouse_id] : []),
    ...((spouseRows as { id: string }[] | null) ?? []).map((p) => p.id),
  ];
  const { data: linkRows } = await supabase.from("family_links").select("rower_id").in("guardian_id", householdIds);
  const rowerIds = [
    ...new Set([
      ...(me.role === "rower" || me.role === "coxswain" ? [user.id] : []),
      ...((linkRows as { rower_id: string }[] | null) ?? []).map((l) => l.rower_id),
    ]),
  ];

  const [{ data: rowerRows }, { data: chargeRows }, { data: billRows }, { data: settingsRow }, { data: discountRows }] =
    await Promise.all([
      rowerIds.length
        ? supabase.from("profiles").select("id, display_name").in("id", rowerIds).is("disabled_at", null)
        : Promise.resolve({ data: [] }),
      supabase.from("charges").select("*").is("archived_at", null).order("created_at", { ascending: false }),
      supabase.from("bills").select("*").in("rower_id", rowerIds.length ? rowerIds : [user.id]),
      supabase.from("payment_settings").select("*").single(),
      supabase.from("discounts").select("*").eq("active", true),
    ]);
  const rowers = (rowerRows as Pick<Profile, "id" | "display_name">[] | null) ?? [];
  const nameById = new Map(rowers.map((r) => [r.id, r.display_name]));
  const charges = (chargeRows as Charge[] | null) ?? [];
  const chargeById = new Map(charges.map((c) => [c.id, c]));
  const bills = ((billRows as Bill[] | null) ?? []).filter((b) => b.status !== "cancelled");
  const settings = settingsRow as PaymentSettings;
  const discounts = (discountRows as Discount[] | null) ?? [];
  const online = !!process.env.STRIPE_SECRET_KEY && settings.stripe_charges_enabled;

  const { data: paymentRows } = bills.length
    ? await supabase
        .from("payments")
        .select("*")
        .in(
          "bill_id",
          bills.map((b) => b.id)
        )
        .order("created_at", { ascending: false })
    : { data: [] };
  const payments = (paymentRows as Payment[] | null) ?? [];

  const billedKey = new Set(bills.map((b) => `${b.charge_id}:${b.rower_id}`));
  const signups = charges
    .filter((c) => c.signup_open)
    .flatMap((c) => rowers.filter((r) => !billedKey.has(`${c.id}:${r.id}`)).map((r) => ({ charge: c, rower: r })));

  const feeNote = `Plus a ${PLATFORM_FEE_BPS / 100}% ${CONVENIENCE_FEE_LABEL.toLowerCase()} and the card processing fee.`;

  function planLabel(charge: Charge, totalCents: number) {
    if (!charge.allow_installments) return null;
    const each = installmentAmounts(totalCents, charge.installment_count);
    return `${charge.installment_count} payments of ${formatMoney(each[each.length - 1])}, every ${charge.installment_interval_days} days`;
  }

  return (
    <div className="min-h-screen p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Payments</h1>
        {isTreasurer && (
          <Link href="/payments/manage" className="text-sm font-medium text-[var(--color-primary)] underline">
            Manage payments →
          </Link>
        )}
      </div>

      {paid && (
        <p className="mb-6 rounded-lg border-2 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-800">
          Thank you! Your payment is going through. It shows as paid here within a minute.
        </p>
      )}

      {signups.length > 0 && (
        <section className="mb-8 flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Sign up</h2>
          {signups.map(({ charge, rower }) => {
            const { discountCents, note } = applicableDiscount(charge.amount_cents, discounts, charge.id, rower.id);
            const total = charge.amount_cents - discountCents;
            return (
              <div key={`${charge.id}:${rower.id}`} className="rounded-lg border-2 border-[var(--color-primary)] p-4">
                <p className="font-semibold">
                  {charge.title} — {rower.display_name}
                </p>
                {charge.description && <p className="text-sm text-gray-600 mt-1">{charge.description}</p>}
                <p className="text-sm mt-2">
                  {discountCents > 0 ? (
                    <>
                      <span className="line-through text-gray-400">{formatMoney(charge.amount_cents)}</span>{" "}
                      <strong>{formatMoney(total)}</strong>{" "}
                      <span className="text-green-700">({note}: −{formatMoney(discountCents)})</span>
                    </>
                  ) : (
                    <strong>{formatMoney(total)}</strong>
                  )}
                </p>
                <p className="text-xs text-gray-500 mb-3">{feeNote}</p>
                <PayButtons
                  mode="signup"
                  chargeId={charge.id}
                  rowerId={rower.id}
                  fullLabel={online ? `Sign up and pay ${formatMoney(total)}` : "Sign up"}
                  planLabel={online ? planLabel(charge, total) : null}
                  online={online}
                />
              </div>
            );
          })}
        </section>
      )}

      <section className="mb-8 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Bills</h2>
        {bills.length === 0 && <p className="text-sm text-gray-500">Nothing owed right now.</p>}
        {bills.map((bill) => {
          const charge = chargeById.get(bill.charge_id);
          const total = billTotal(bill);
          const billPayments = payments.filter((p) => p.bill_id === bill.id);
          const paidSoFar = amountPaid(billPayments);
          const balance = total - paidSoFar;
          const installmentsPaid = billPayments.filter((p) => p.status === "succeeded" && p.installment_number).length;
          return (
            <div key={bill.id} className="rounded-lg border-2 border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {charge?.title ?? "Charge"} — {nameById.get(bill.rower_id) ?? "Rower"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatMoney(total)}
                    {bill.discount_cents > 0 && (
                      <span className="text-green-700">
                        {" "}
                        ({bill.discount_note ?? "Discount"}: −{formatMoney(bill.discount_cents)})
                      </span>
                    )}
                    {charge?.due_date && <> · due {new Date(`${charge.due_date}T12:00:00`).toLocaleDateString()}</>}
                  </p>
                  {bill.plan === "installments" && bill.stripe_subscription_id && charge && (
                    <p className="text-sm text-gray-600">
                      Payment plan: {installmentsPaid} of {charge.installment_count} paid
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    bill.status === "paid" || bill.status === "waived"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-900"
                  }`}
                >
                  {bill.status === "owed" && paidSoFar > 0 ? `${formatMoney(balance)} left` : BILL_STATUS_LABELS[bill.status]}
                </span>
              </div>
              {bill.status === "owed" && balance > 0 && charge && !bill.stripe_subscription_id && (
                <div className="mt-3">
                  <PayButtons
                    mode="pay"
                    billId={bill.id}
                    fullLabel={`Pay ${formatMoney(balance)}`}
                    planLabel={paidSoFar === 0 ? planLabel(charge, balance) : null}
                    online={online}
                  />
                  {online && <p className="text-xs text-gray-500 mt-1">{feeNote}</p>}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {payments.some((p) => p.status !== "pending") && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Payment history</h2>
          {payments
            .filter((p) => p.status !== "pending")
            .map((p) => {
              const bill = bills.find((b) => b.id === p.bill_id);
              const charge = bill ? chargeById.get(bill.charge_id) : undefined;
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm border-b py-2">
                  <span>
                    {new Date(p.paid_at ?? p.created_at).toLocaleDateString()} · {charge?.title ?? "Payment"}
                    {p.installment_number && ` (payment ${p.installment_number})`} ·{" "}
                    <span className="text-gray-500">{p.method === "card" ? "Card" : p.method}</span>
                  </span>
                  <span className={p.status === "succeeded" ? "font-medium" : "text-red-600"}>
                    {formatMoney(p.amount_cents)}
                    {p.status === "refunded" && " refunded"}
                    {p.status === "failed" && " failed"}
                  </span>
                </div>
              );
            })}
        </section>
      )}
    </div>
  );
}
