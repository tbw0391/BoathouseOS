import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Bill, Charge, Lineup } from "@/lib/database.types";
import { billBalance } from "@/lib/billing";
import { formatMoney } from "@/lib/payments";
import { activeMemberIds, guardianIdsFor, householdIdsForRower, sendPush } from "@/lib/push";
import { LAUNCH_MINUTES_KEY, clubTimeLabel, launchTime, parseLaunchMinutes } from "@/lib/raceDay";

// Alerts that depend on the clock rather than on someone doing something.
// Run every 5 minutes by /api/cron/alerts (see 0080_scheduled_alerts.sql).
// Each one is claimed in scheduled_alerts_sent before sending, so it goes out
// once even if two runs overlap.

type Admin = ReturnType<typeof createAdminClient>;

const easternDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

// Returns the refs that were newly claimed (not sent before).
async function claim(admin: Admin, kind: string, refs: string[]): Promise<Set<string>> {
  if (refs.length === 0) return new Set();
  const { data, error } = await admin
    .from("scheduled_alerts_sent")
    .upsert(
      refs.map((ref) => ({ kind, ref })),
      { onConflict: "kind,ref", ignoreDuplicates: true }
    )
    .select("ref");
  if (error) throw new Error(error.message);
  return new Set(((data as { ref: string }[] | null) ?? []).map((r) => r.ref));
}

// The 7-days-out job drafted a food list; tell whoever can publish it.
async function foodDraftAlerts(admin: Admin) {
  const { data } = await admin
    .from("food_tent_status")
    .select("event_id, schedule_events(title)")
    .eq("status", "pending_confirmation")
    .gte("draft_generated_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
  const drafts = (data as unknown as { event_id: string; schedule_events: { title: string } | null }[] | null) ?? [];
  const claimed = await claim(admin, "food_draft", drafts.map((d) => d.event_id));
  const ready = drafts.filter((d) => claimed.has(d.event_id));
  if (ready.length === 0) return;

  const { data: leaders } = await admin
    .from("profiles")
    .select("id")
    .eq("is_tent_leader", true)
    .not("approved_at", "is", null)
    .is("disabled_at", null);
  const managers = [
    ...(await activeMemberIds(["coach", "admin"])),
    ...((leaders as { id: string }[] | null) ?? []).map((p) => p.id),
  ];

  for (const draft of ready) {
    await sendPush(managers, {
      kind: "food_draft",
      title: "Food list draft ready",
      body: `${draft.schedule_events?.title ?? "The next regatta"}: review it and publish it for parents.`,
      url: "/food-tent",
      tag: `food-draft-${draft.event_id}`,
    });
  }
}

// Bills paid by hand (not on an automatic plan): 3 days before the due date,
// and the day after if still unpaid. Overdue bills more than a week old are
// left alone so turning this on doesn't flood people about old ones.
async function paymentDueAlerts(admin: Admin) {
  const today = new Date();
  const todayKey = easternDate(today);
  const inThreeDays = easternDate(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000));
  const weekAgo = easternDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));

  const { data: chargesData } = await admin
    .from("charges")
    .select("id, title, due_date")
    .gte("due_date", weekAgo)
    .lte("due_date", inThreeDays);
  const charges = (chargesData as Pick<Charge, "id" | "title" | "due_date">[] | null) ?? [];
  if (charges.length === 0) return;
  const chargeById = new Map(charges.map((c) => [c.id, c]));

  const { data: billsData } = await admin
    .from("bills")
    .select("*")
    .eq("status", "owed")
    .is("stripe_subscription_id", null)
    .in("charge_id", charges.map((c) => c.id));
  const bills = (billsData as Bill[] | null) ?? [];

  const dueSoon = bills.filter((b) => chargeById.get(b.charge_id)!.due_date! >= todayKey);
  const overdue = bills.filter((b) => chargeById.get(b.charge_id)!.due_date! < todayKey);
  const [claimedSoon, claimedOver] = await Promise.all([
    claim(admin, "payment_due", dueSoon.map((b) => b.id)),
    claim(admin, "payment_overdue", overdue.map((b) => b.id)),
  ]);

  const toSend = [
    ...dueSoon.filter((b) => claimedSoon.has(b.id)).map((b) => ({ bill: b, late: false })),
    ...overdue.filter((b) => claimedOver.has(b.id)).map((b) => ({ bill: b, late: true })),
  ];
  for (const { bill, late } of toSend) {
    const balance = await billBalance(admin, bill);
    if (balance <= 0) continue;
    const charge = chargeById.get(bill.charge_id)!;
    const { data: rower } = await admin.from("profiles").select("display_name").eq("id", bill.rower_id).single();
    const dueLabel = new Date(`${charge.due_date}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    await sendPush(await householdIdsForRower(bill.rower_id), {
      kind: "payment_due",
      title: late ? "Payment overdue" : `Payment due ${dueLabel}`,
      body: `${charge.title} for ${(rower as { display_name: string } | null)?.display_name ?? "your rower"}: ${formatMoney(balance)} left${late ? `, due ${dueLabel}` : ""}.`,
      url: "/payments",
      tag: `bill-${bill.id}`,
    });
  }
}

// 15 minutes before each race's launch time (race time minus the club's
// launch minutes), tell the crew and their parents.
async function launchSoonAlerts(admin: Admin) {
  const { data: setting } = await admin
    .from("club_settings")
    .select("value")
    .eq("key", LAUNCH_MINUTES_KEY)
    .maybeSingle();
  const launchMinutes = parseLaunchMinutes((setting as { value: string | null } | null)?.value);

  // Launch within the next 15 minutes (the job runs every 5).
  const now = Date.now();
  const from = new Date(now + launchMinutes * 60 * 1000).toISOString();
  const to = new Date(now + (launchMinutes + 15) * 60 * 1000).toISOString();
  const { data } = await admin
    .from("lineups")
    .select("id, boat_name, race_name, race_time, bow_number, place")
    .gte("race_time", from)
    .lte("race_time", to)
    .is("place", null);
  const lineups =
    (data as Pick<Lineup, "id" | "boat_name" | "race_name" | "race_time" | "bow_number" | "place">[] | null) ?? [];
  const claimed = await claim(admin, "launch_soon", lineups.map((l) => l.id));

  for (const lineup of lineups.filter((l) => claimed.has(l.id))) {
    const { data: seatRows } = await admin.from("lineup_seats").select("rower_id").eq("lineup_id", lineup.id);
    const crew = ((seatRows as { rower_id: string | null }[] | null) ?? [])
      .map((s) => s.rower_id)
      .filter((id): id is string => !!id);
    if (crew.length === 0) continue;
    const launch = launchTime(lineup.race_time!, launchMinutes);
    await sendPush([...crew, ...(await guardianIdsFor(crew))], {
      kind: "launch_soon",
      title: `Launch at ${clubTimeLabel(launch)}`,
      body: `${lineup.race_name ?? lineup.boat_name}${lineup.bow_number ? `, bow #${lineup.bow_number}` : ""}: race at ${clubTimeLabel(lineup.race_time!)}.`,
      url: "/race-day",
      tag: `launch-${lineup.id}`,
    });
  }
}

export async function runScheduledAlerts() {
  const admin = createAdminClient();
  const results = await Promise.allSettled([
    foodDraftAlerts(admin),
    paymentDueAlerts(admin),
    launchSoonAlerts(admin),
  ]);
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  for (const f of failures) console.error("Scheduled alert failed", f.reason);
  return { ok: failures.length === 0 };
}
