import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Bill, Charge, Lineup } from "@/lib/database.types";
import { billBalance } from "@/lib/billing";
import { formatMoney } from "@/lib/payments";
import { activeMemberIds, guardianIdsFor, householdIdsForRower, sendPush } from "@/lib/push";
import { EXPIRING_DAYS, PAPERWORK } from "@/lib/paperwork";
import { LAUNCH_MINUTES_KEY, clubTimeLabel, delayedRaceTime, launchTime, parseLaunchMinutes } from "@/lib/raceDay";

// Alerts that depend on the clock rather than on someone doing something.
// Run every 5 minutes by /api/cron/alerts (see 0080_scheduled_alerts.sql).
// Each one is claimed in scheduled_alerts_sent before sending, so it goes out
// once even if two runs overlap.

type Admin = ReturnType<typeof createAdminClient>;

// The longest race-day delay a coach can set (schedule_events check, 0102).
const MAX_DELAY_MINUTES = 240;

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
    .select("event_id, club_id, schedule_events(title)")
    .eq("status", "pending_confirmation")
    .gte("draft_generated_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
  const drafts =
    (data as unknown as { event_id: string; club_id: string; schedule_events: { title: string } | null }[] | null) ?? [];
  const claimed = await claim(admin, "food_draft", drafts.map((d) => d.event_id));
  const ready = drafts.filter((d) => claimed.has(d.event_id));
  if (ready.length === 0) return;

  for (const draft of ready) {
    const { data: leaders } = await admin
      .from("profiles")
      .select("id")
      .eq("club_id", draft.club_id)
      .eq("is_tent_leader", true)
      .not("approved_at", "is", null)
      .is("disabled_at", null);
    const managers = [
      ...(await activeMemberIds(draft.club_id, ["coach", "admin"])),
      ...((leaders as { id: string }[] | null) ?? []).map((p) => p.id),
    ];
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

// 15 minutes before each race's launch time (race time, plus however late
// the coach says the regatta is running, minus the club's launch minutes),
// tell the crew and their parents.
async function launchSoonAlerts(admin: Admin) {
  // Each club sets its own launch minutes.
  const { data: settings } = await admin.from("club_settings").select("club_id, value").eq("key", LAUNCH_MINUTES_KEY);
  const minutesByClub = new Map(
    ((settings as { club_id: string; value: string | null }[] | null) ?? []).map((s) => [
      s.club_id,
      parseLaunchMinutes(s.value),
    ])
  );
  const launchMinutesFor = (clubId: string) => minutesByClub.get(clubId) ?? parseLaunchMinutes(null);
  const longestLaunch = Math.max(parseLaunchMinutes(null), ...minutesByClub.values());

  // Launch within the next 15 minutes (the job runs every 5). Races
  // scheduled up to the longest delay earlier may be due too.
  const now = Date.now();
  const window = (clubId: string) => ({
    from: now + launchMinutesFor(clubId) * 60 * 1000,
    to: now + (launchMinutesFor(clubId) + 15) * 60 * 1000,
  });
  const { data } = await admin
    .from("lineups")
    .select("id, club_id, boat_name, race_name, race_time, bow_number, place, schedule_events(race_delay_minutes)")
    .gte("race_time", new Date(now - MAX_DELAY_MINUTES * 60 * 1000).toISOString())
    .lte("race_time", new Date(now + (longestLaunch + 15) * 60 * 1000).toISOString())
    .is("place", null);
  const lineups = (
    (data as unknown as (Pick<Lineup, "id" | "boat_name" | "race_name" | "race_time" | "bow_number" | "place"> & {
      club_id: string;
      schedule_events: { race_delay_minutes: number } | null;
    })[] | null) ?? []
  )
    .map((l) => ({ ...l, race_time: delayedRaceTime(l.race_time!, l.schedule_events?.race_delay_minutes) }))
    .filter((l) => {
      const t = new Date(l.race_time).getTime();
      const { from, to } = window(l.club_id);
      return t >= from && t <= to;
    });
  const claimed = await claim(admin, "launch_soon", lineups.map((l) => l.id));

  for (const lineup of lineups.filter((l) => claimed.has(l.id))) {
    const { data: seatRows } = await admin.from("lineup_seats").select("rower_id").eq("lineup_id", lineup.id);
    const crew = ((seatRows as { rower_id: string | null }[] | null) ?? [])
      .map((s) => s.rower_id)
      .filter((id): id is string => !!id);
    if (crew.length === 0) continue;
    const launch = launchTime(lineup.race_time!, launchMinutesFor(lineup.club_id));
    await sendPush([...crew, ...(await guardianIdsFor(crew))], {
      kind: "launch_soon",
      title: `Launch at ${clubTimeLabel(launch)}`,
      body: `${lineup.race_name ?? lineup.boat_name}${lineup.bow_number ? `, bow #${lineup.bow_number}` : ""}: race at ${clubTimeLabel(lineup.race_time!)}.`,
      url: "/race-day",
      tag: `launch-${lineup.id}`,
    });
  }
}

// Paperwork running out: 30 days before, and on the day.
async function paperworkAlerts(admin: Admin) {
  const today = easternDate(new Date());
  const inThirty = easternDate(new Date(Date.now() + EXPIRING_DAYS * 24 * 60 * 60 * 1000));
  const { data } = await admin
    .from("member_paperwork")
    .select("profile_id, kind, expires_on")
    .in("expires_on", [today, inThirty]);
  const rows = (data as { profile_id: string; kind: string; expires_on: string }[] | null) ?? [];
  const ref = (r: (typeof rows)[number]) => `${r.profile_id}:${r.kind}:${r.expires_on}:${r.expires_on === today ? 0 : 30}`;
  const claimed = await claim(admin, "paperwork_expiring", rows.map(ref));

  for (const r of rows.filter((row) => claimed.has(ref(row)))) {
    const label = PAPERWORK.find((p) => p.kind === r.kind)?.label ?? "Paperwork";
    const { data: person } = await admin.from("profiles").select("display_name, disabled_at").eq("id", r.profile_id).single();
    const p = person as { display_name: string; disabled_at: string | null } | null;
    if (!p || p.disabled_at) continue;
    const when = new Date(`${r.expires_on}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    await sendPush([r.profile_id, ...(await guardianIdsFor([r.profile_id]))], {
      kind: "paperwork_expiring",
      title: r.expires_on === today ? `${label} runs out today` : `${label} runs out ${when}`,
      body: `${p.display_name}: renew it, then update the date on their profile.`,
      url: `/roster/${r.profile_id}`,
      tag: `paperwork-${r.profile_id}-${r.kind}`,
    });
  }
}

// A tracked regatta boat crossed the start (set on its lineup by the
// location_pings trigger in 0098, which also calls this right away): tell
// the crew's parents and the boat's followers.
async function raceStartAlerts(admin: Admin) {
  const { data } = await admin
    .from("lineups")
    .select("id, boat_id, boat_name, race_name")
    .gte("race_started_at", new Date(Date.now() - 20 * 60 * 1000).toISOString());
  const races =
    (data as Pick<Lineup, "id" | "boat_id" | "boat_name" | "race_name">[] | null) ?? [];
  const fresh = await claim(admin, "race_started", races.map((r) => r.id));

  for (const r of races.filter((x) => fresh.has(x.id))) {
    const [{ data: seats }, { data: followers }] = await Promise.all([
      admin.from("lineup_seats").select("rower_id").eq("lineup_id", r.id),
      r.boat_id
        ? admin.from("on_water_follows").select("profile_id").eq("boat_id", r.boat_id)
        : Promise.resolve({ data: [] }),
    ]);
    const crew = ((seats as { rower_id: string | null }[] | null) ?? [])
      .map((x) => x.rower_id)
      .filter((id): id is string => !!id);
    await sendPush(
      [
        ...(await guardianIdsFor(crew)),
        ...((followers as { profile_id: string }[] | null) ?? []).map((f) => f.profile_id),
      ].filter((id) => !crew.includes(id)),
      {
        kind: "race_started",
        title: `${r.boat_name} is racing now`,
        body: `${r.race_name ?? "Their race"} just started. Tap to watch live.`,
        url: "/on-water",
        tag: `race-${r.id}`,
      }
    );
  }
}

export async function runScheduledAlerts() {
  const admin = createAdminClient();
  const results = await Promise.allSettled([
    foodDraftAlerts(admin),
    paymentDueAlerts(admin),
    launchSoonAlerts(admin),
    paperworkAlerts(admin),
    raceStartAlerts(admin),
  ]);
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  for (const f of failures) console.error("Scheduled alert failed", f.reason);
  return { ok: failures.length === 0 };
}
