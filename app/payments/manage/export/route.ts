import { createClient } from "@/lib/supabase/server";
import type { Bill, Charge, Payment, Profile } from "@/lib/database.types";
import { amountPaid, billTotal } from "@/lib/payments";

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const dollars = (cents: number) => (cents / 100).toFixed(2);

// Treasurer's CSV of bills: every charge, or one (?charge=<id>).
export async function GET(request: Request) {
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
  if (me?.role !== "admin" && !me?.is_treasurer) return new Response("Not allowed.", { status: 403 });

  const chargeId = new URL(request.url).searchParams.get("charge");
  const billQuery = supabase.from("bills").select("*");
  const [{ data: billRows }, { data: chargeRows }] = await Promise.all([
    chargeId ? billQuery.eq("charge_id", chargeId) : billQuery,
    supabase.from("charges").select("*"),
  ]);
  const bills = (billRows as Bill[] | null) ?? [];
  const chargeById = new Map(((chargeRows as Charge[] | null) ?? []).map((c) => [c.id, c]));
  const billIds = bills.map((b) => b.id);
  const [{ data: paymentRows }, { data: nameRows }] = await Promise.all([
    billIds.length ? supabase.from("payments").select("*").in("bill_id", billIds) : Promise.resolve({ data: [] }),
    bills.length
      ? supabase
          .from("profiles")
          .select("id, display_name")
          .in(
            "id",
            bills.map((b) => b.rower_id)
          )
      : Promise.resolve({ data: [] }),
  ]);
  const payments = (paymentRows as Payment[] | null) ?? [];
  const nameById = new Map(
    ((nameRows as Pick<Profile, "id" | "display_name">[] | null) ?? []).map((p) => [p.id, p.display_name])
  );

  const lines = [
    ["Charge", "Rower", "Amount", "Discount", "Discount reason", "Total", "Paid", "Balance", "Status", "Plan"].join(","),
    ...bills.map((b) => {
      const paid = amountPaid(payments.filter((p) => p.bill_id === b.id));
      const total = billTotal(b);
      return [
        chargeById.get(b.charge_id)?.title,
        nameById.get(b.rower_id),
        dollars(b.amount_cents),
        dollars(b.discount_cents),
        b.discount_note,
        dollars(total),
        dollars(paid),
        dollars(Math.max(0, total - paid)),
        b.status,
        b.plan,
      ]
        .map(csvCell)
        .join(",");
    }),
  ];

  const name = chargeId ? chargeById.get(chargeId)?.title ?? "charge" : "all-charges";
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-bills.csv"`,
    },
  });
}
