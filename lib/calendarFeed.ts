import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Lineup, Profile, ScheduleEvent } from "@/lib/database.types";
import { STANDING_PRACTICES } from "@/lib/scheduleCalendar";
import { buildCalendar, clubDateTime, type IcalEvent } from "@/lib/ical";
import {
  LAUNCH_MINUTES_KEY,
  clubDateKey,
  clubTimeLabel,
  launchTime,
  parseLaunchMinutes,
} from "@/lib/raceDay";

const DAY_MS = 24 * 60 * 60 * 1000;
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const RRULES: Record<string, string> = { weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY", yearly: "FREQ=YEARLY" };

function addDays(dateKey: string, n: number): string {
  return new Date(new Date(`${dateKey}T12:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

// Every club-time day a practice or regatta falls on between the two dates,
// repeats included, so standing practices can skip those days (as the
// Schedule page does).
function busyDays(events: ScheduleEvent[], fromKey: string, toKey: string): Set<string> {
  const days = new Set<string>();
  for (const e of events) {
    if (e.event_type !== "practice" && e.event_type !== "regatta") continue;
    const start = new Date(e.starts_at);
    for (let n = 0; n < 400; n++) {
      const d = new Date(start);
      if (e.recurrence === "weekly") d.setUTCDate(start.getUTCDate() + 7 * n);
      else if (e.recurrence === "monthly") d.setUTCMonth(start.getUTCMonth() + n);
      else if (e.recurrence === "yearly") d.setUTCFullYear(start.getUTCFullYear() + n);
      else if (n > 0) break;
      const key = clubDateKey(d);
      if (key > toKey) break;
      if (key >= fromKey) days.add(key);
    }
  }
  return days;
}

// The feed for one member: the club schedule, standing practices, and the
// races they (or, for parents, their rowers) are in. Coaches and admins get
// every club race.
export async function calendarFeedFor(token: string, siteUrl: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: feed } = await admin.from("calendar_feeds").select("profile_id").eq("token", token).maybeSingle();
  const profileId = (feed as { profile_id: string } | null)?.profile_id;
  if (!profileId) return null;

  const { data: profileRow } = await admin
    .from("profiles")
    .select("id, club_id, role, spouse_id, approved_at, disabled_at")
    .eq("id", profileId)
    .maybeSingle();
  const profile = profileRow as Pick<Profile, "id" | "club_id" | "role" | "spouse_id" | "approved_at" | "disabled_at"> | null;
  if (!profile || !profile.approved_at || profile.disabled_at) return null;

  const now = new Date();
  const todayKey = clubDateKey(now);
  const fromKey = addDays(todayKey, -60);
  const toKey = addDays(todayKey, 365);
  const from = clubDateTime(fromKey, "00:00");

  const [{ data: eventRows }, { data: brandingRow }, { data: launchRow }] = await Promise.all([
    admin.from("schedule_events").select("*").eq("club_id", profile.club_id).or(`starts_at.gte.${from.toISOString()},recurrence.neq.none`),
    admin.from("club_settings").select("value").eq("club_id", profile.club_id).eq("key", "branding").maybeSingle(),
    admin.from("club_settings").select("value").eq("club_id", profile.club_id).eq("key", LAUNCH_MINUTES_KEY).maybeSingle(),
  ]);
  const events = (eventRows as ScheduleEvent[] | null) ?? [];
  let clubName = "BoathouseOS";
  try {
    clubName = JSON.parse((brandingRow as { value: string | null } | null)?.value ?? "{}").clubName || clubName;
  } catch {}
  const launchMinutes = parseLaunchMinutes((launchRow as { value: string | null } | null)?.value);

  const items: IcalEvent[] = events.map((e) => ({
    uid: `event-${e.id}@boathouseos`,
    title: e.title,
    start: new Date(e.starts_at),
    end: e.ends_at ? new Date(e.ends_at) : null,
    location: e.location,
    description: e.description,
    url: `${siteUrl}/schedule`,
    rrule: RRULES[e.recurrence] ?? null,
  }));

  // Standing practices, one repeating event per time slot.
  const busy = busyDays(events, fromKey, toKey);
  STANDING_PRACTICES.forEach((slot, i) => {
    let first = fromKey;
    while (!slot.days.includes(new Date(`${first}T12:00:00Z`).getUTCDay())) first = addDays(first, 1);
    const exdates: Date[] = [];
    for (let d = first; d <= toKey; d = addDays(d, 1)) {
      if (slot.days.includes(new Date(`${d}T12:00:00Z`).getUTCDay()) && busy.has(d)) {
        exdates.push(clubDateTime(d, slot.start));
      }
    }
    items.push({
      uid: `standing-practice-${i}@boathouseos`,
      title: "Practice",
      start: clubDateTime(first, slot.start),
      end: clubDateTime(first, slot.end),
      rrule: `FREQ=WEEKLY;BYDAY=${slot.days.map((d) => BYDAY[d]).join(",")}`,
      exdates,
    });
  });

  // Races.
  let rowerIds: string[] | null = null;
  if (profile.role === "rower" || profile.role === "coxswain") {
    rowerIds = [profile.id];
  } else if (profile.role === "parent") {
    const household = [profile.id];
    if (profile.spouse_id) household.push(profile.spouse_id);
    const { data: reverse } = await admin.from("profiles").select("id").eq("spouse_id", profile.id);
    household.push(...((reverse as { id: string }[] | null) ?? []).map((p) => p.id));
    const { data: links } = await admin.from("family_links").select("rower_id").in("guardian_id", household);
    rowerIds = [...new Set(((links as { rower_id: string }[] | null) ?? []).map((l) => l.rower_id))];
  }

  const { data: lineupRows } = await admin
    .from("lineups")
    .select("*")
    .eq("club_id", profile.club_id)
    .not("race_time", "is", null)
    .gte("race_time", from.toISOString());
  let lineups = (lineupRows as Lineup[] | null) ?? [];
  const { data: seatRows } = lineups.length
    ? await admin
        .from("lineup_seats")
        .select("lineup_id, rower_id")
        .in(
          "lineup_id",
          lineups.map((l) => l.id)
        )
    : { data: [] };
  const seats = (seatRows as { lineup_id: string; rower_id: string | null }[] | null) ?? [];
  const nameIds = [...new Set(seats.map((s) => s.rower_id).filter((id): id is string => !!id))];
  const { data: nameRows } = nameIds.length
    ? await admin.from("profiles").select("id, first_name, display_name").in("id", nameIds)
    : { data: [] };
  const nameById = new Map(
    ((nameRows as { id: string; first_name: string | null; display_name: string }[] | null) ?? []).map((p) => [
      p.id,
      p.first_name || p.display_name,
    ])
  );
  if (rowerIds) {
    const mine = new Set(seats.filter((s) => s.rower_id && rowerIds!.includes(s.rower_id)).map((s) => s.lineup_id));
    lineups = lineups.filter((l) => mine.has(l.id));
  }

  for (const l of lineups) {
    const kids =
      profile.role === "parent"
        ? seats
            .filter((s) => s.lineup_id === l.id && s.rower_id && rowerIds!.includes(s.rower_id))
            .map((s) => nameById.get(s.rower_id!) ?? "")
            .filter(Boolean)
        : [];
    const launch = launchTime(l.race_time!, launchMinutes);
    items.push({
      uid: `race-${l.id}@boathouseos`,
      title: `Race${kids.length ? ` (${kids.join(", ")})` : ""}: ${l.race_name ?? l.boat_name}`,
      start: new Date(l.race_time!),
      end: new Date(new Date(l.race_time!).getTime() + 30 * 60 * 1000),
      description: [
        `Boat: ${l.boat_name}`,
        l.bow_number ? `Bow #${l.bow_number}` : null,
        `Launch ${clubTimeLabel(launch)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      url: `${siteUrl}/race-day`,
    });
  }

  return buildCalendar(clubName, items, now);
}
