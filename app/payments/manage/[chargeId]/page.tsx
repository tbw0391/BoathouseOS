import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Bill, Charge, Payment, Profile } from "@/lib/database.types";
import {
  BILL_STATUS_LABELS,
  CHARGE_KIND_LABELS,
  amountPaid,
  billTotal,
  formatMoney,
} from "@/lib/payments";
import { AssignPanel, BillActions, ChargeToggles } from "./ChargeControls";

// One charge: who's billed, what each owes after discounts, what's in, and
// the treasurer's per-bill tools.
export default async function ChargePage({ params }: { params: Promise<{ chargeId: string }> }) {
  const { chargeId } = await params;
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

  const { data: chargeRow } = await supabase.from("charges").select("*").eq("id", chargeId).single();
  if (!chargeRow) notFound();
  const charge = chargeRow as Charge;

  const [{ data: billRows }, { data: rowerRows }] = await Promise.all([
    supabase.from("bills").select("*").eq("charge_id", chargeId),
    supabase
      .from("profiles")
      .select("id, display_name")
      .in("role", ["rower", "coxswain"])
      .is("disabled_at", null)
      .order("display_name", { ascending: true }),
  ]);
  const bills = (billRows as Bill[] | null) ?? [];
  const rowers = (rowerRows as Pick<Profile, "id" | "display_name">[] | null) ?? [];
  const { data: paymentRows } = bills.length
    ? await supabase
        .from("payments")
        .select("*")
        .in(
          "bill_id",
          bills.map((b) => b.id)
        )
    : { data: [] };
  const payments = (paymentRows as Payment[] | null) ?? [];

  const { data: nameRows } = bills.length
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in(
          "id",
          bills.map((b) => b.rower_id)
        )
    : { data: [] };
  const nameById = new Map(
    ((nameRows as Pick<Profile, "id" | "display_name">[] | null) ?? []).map((p) => [p.id, p.display_name])
  );
  const billedIds = new Set(bills.map((b) => b.rower_id));

  const rows = bills
    .map((bill) => {
      const paid = amountPaid(payments.filter((p) => p.bill_id === bill.id));
      return { bill, name: nameById.get(bill.rower_id) ?? "Unknown", total: billTotal(bill), paid };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const live = rows.filter((r) => r.bill.status !== "cancelled" && r.bill.status !== "waived");
  const collected = rows.reduce((s, r) => s + r.paid, 0);
  const expected = live.reduce((s, r) => s + r.total, 0);

  return (
    <div className="min-h-screen p-8 max-w-3xl flex flex-col gap-6">
      <div>
        <Link href="/payments/manage" className="text-sm text-gray-500 hover:underline">
          ← Manage payments
        </Link>
        <h1 className="text-2xl font-bold mt-4">{charge.title}</h1>
        <p className="text-sm text-gray-600">
          {CHARGE_KIND_LABELS[charge.kind]} · {formatMoney(charge.amount_cents)}
          {charge.due_date && ` · due ${new Date(`${charge.due_date}T12:00:00`).toLocaleDateString()}`}
          {charge.allow_installments &&
            ` · ${charge.installment_count} payments every ${charge.installment_interval_days} days allowed`}
        </p>
        {charge.description && <p className="text-sm text-gray-600 mt-1">{charge.description}</p>}
        <div className="mt-2">
          <ChargeToggles chargeId={charge.id} signupOpen={charge.signup_open} archived={!!charge.archived_at} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border-2 border-gray-200 p-3">
          <p className="text-xs text-gray-500">Collected</p>
          <p className="text-lg font-semibold">{formatMoney(collected)}</p>
        </div>
        <div className="rounded-lg border-2 border-gray-200 p-3">
          <p className="text-xs text-gray-500">Still owed</p>
          <p className="text-lg font-semibold">
            {formatMoney(Math.max(0, live.reduce((s, r) => s + Math.max(0, r.total - r.paid), 0)))}
          </p>
        </div>
        <div className="rounded-lg border-2 border-gray-200 p-3">
          <p className="text-xs text-gray-500">Paid in full</p>
          <p className="text-lg font-semibold">
            {rows.filter((r) => r.bill.status === "paid").length}/{live.length}
          </p>
        </div>
      </div>
      <p className="text-xs text-gray-500 -mt-4">Expected after discounts: {formatMoney(expected)}</p>

      {!charge.archived_at && (
        <AssignPanel
          chargeId={charge.id}
          rowers={rowers.map((r) => ({ ...r, billed: billedIds.has(r.id) }))}
        />
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Bills ({rows.length})</h2>
          <Link
            href={`/payments/manage/export?charge=${charge.id}`}
            prefetch={false}
            className="text-sm text-gray-600 underline"
          >
            Export CSV
          </Link>
        </div>
        {rows.length === 0 && <p className="text-sm text-gray-500">No one billed yet.</p>}
        {rows.map(({ bill, name, total, paid }) => (
          <div key={bill.id} className="rounded-lg border-2 border-gray-200 p-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{name}</p>
                <p className="text-xs text-gray-500">
                  {formatMoney(total)}
                  {bill.discount_cents > 0 &&
                    ` after ${bill.discount_note ?? "discount"} −${formatMoney(bill.discount_cents)}`}
                  {bill.plan === "installments" && " · payment plan"}
                  {paid > 0 && ` · ${formatMoney(paid)} paid`}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  bill.status === "paid" || bill.status === "waived"
                    ? "bg-green-100 text-green-800"
                    : bill.status === "cancelled"
                      ? "bg-gray-100 text-gray-500"
                      : "bg-yellow-100 text-yellow-900"
                }`}
              >
                {BILL_STATUS_LABELS[bill.status]}
              </span>
            </div>
            <BillActions
              billId={bill.id}
              status={bill.status}
              discountDollars={(bill.discount_cents / 100).toFixed(2)}
              discountNote={bill.discount_note ?? ""}
              balanceDollars={(Math.max(0, total - paid) / 100).toFixed(2)}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
