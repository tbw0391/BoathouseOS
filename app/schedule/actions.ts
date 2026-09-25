"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { EventType, Role, ScheduleRecurrence } from "@/lib/database.types";
import { extractCrewTimerMobileId, fetchCrewTimerRegattaPreview, type CrewTimerRaceRow } from "@/lib/crewtimer";
import { fetchUrlMeta } from "@/lib/urlMeta";
import { importRaces } from "@/app/lineups/actions";

const EVENT_TYPES: EventType[] = ["practice", "regatta", "meeting", "other"];
const RECURRENCES: ScheduleRecurrence[] = ["none", "weekly", "monthly", "yearly"];

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const callerRole = (callerProfile as { role: Role } | null)?.role;
  if (callerRole !== "admin" && callerRole !== "coach") {
    throw new Error("Only coaches and admins can manage the schedule.");
  }

  return { user };
}

export async function createScheduleEvent(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const title = String(formData.get("title") ?? "").trim();
  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();
  const endsAtRaw = String(formData.get("ends_at") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const eventTypeRaw = String(formData.get("event_type") ?? "practice");
  const event_type: EventType = EVENT_TYPES.includes(eventTypeRaw as EventType)
    ? (eventTypeRaw as EventType)
    : "practice";
  const recurrenceRaw = String(formData.get("recurrence") ?? "none");
  const recurrence: ScheduleRecurrence = RECURRENCES.includes(recurrenceRaw as ScheduleRecurrence)
    ? (recurrenceRaw as ScheduleRecurrence)
    : "none";
  const crewtimerMobileId = String(formData.get("crewtimer_mobile_id") ?? "").trim() || null;

  if (!title || !startsAtRaw) throw new Error("Title and start date/time are required.");

  const { error } = await supabase.from("schedule_events").insert({
    title,
    description,
    location,
    event_type,
    starts_at: new Date(startsAtRaw).toISOString(),
    ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
    recurrence,
    created_by: user.id,
    crewtimer_mobile_id: crewtimerMobileId,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/schedule/${event_type}`);
  revalidatePath("/schedule");
}

export async function updateScheduleEvent(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const eventId = String(formData.get("event_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();
  const endsAtRaw = String(formData.get("ends_at") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const eventType = String(formData.get("event_type") ?? "").trim();
  const recurrenceRaw = String(formData.get("recurrence") ?? "none");
  const recurrence: ScheduleRecurrence = RECURRENCES.includes(recurrenceRaw as ScheduleRecurrence)
    ? (recurrenceRaw as ScheduleRecurrence)
    : "none";
  const crewtimerMobileId = String(formData.get("crewtimer_mobile_id") ?? "").trim() || null;

  if (!eventId) throw new Error("Missing event.");
  if (!title || !startsAtRaw) throw new Error("Title and start date/time are required.");

  const { data: existing } = await supabase
    .from("schedule_events")
    .select("crewtimer_mobile_id")
    .eq("id", eventId)
    .single();
  const mobileIdChanged =
    (existing as { crewtimer_mobile_id: string | null } | null)?.crewtimer_mobile_id !== crewtimerMobileId;

  const { error } = await supabase
    .from("schedule_events")
    .update({
      title,
      description,
      location,
      starts_at: new Date(startsAtRaw).toISOString(),
      ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
      recurrence,
      crewtimer_mobile_id: crewtimerMobileId,
      // A newly-set or changed ID should be fetched right away, not held
      // back by whatever the old ID's last-synced timestamp was.
      ...(mobileIdChanged ? { crewtimer_synced_at: null } : {}),
    })
    .eq("id", eventId);

  if (error) throw new Error(error.message);

  if (eventType) revalidatePath(`/schedule/${eventType}`);
  revalidatePath("/schedule");
}

export async function deleteScheduleEvent(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const eventId = String(formData.get("event_id") ?? "").trim();
  const eventType = String(formData.get("event_type") ?? "").trim();
  if (!eventId) throw new Error("Missing event.");

  const { error } = await supabase.from("schedule_events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);

  if (eventType) revalidatePath(`/schedule/${eventType}`);
  revalidatePath("/schedule");
}

export interface RegattaUrlPreview {
  title: string | null;
  iconUrl: string | null;
  startsAtDate: string | null;
  crewtimerMobileId: string | null;
  raceRows: CrewTimerRaceRow[];
  note: string | null;
}

// RegattaCentral's regatta pages (and its API) sit behind a Cloudflare bot
// challenge / partner-only API key — a server-side fetch always gets a 403,
// so there's no point even trying before falling back to manual entry.
function isRegattaCentralUrl(input: string): boolean {
  try {
    return new URL(input).hostname.toLowerCase().endsWith("regattacentral.com");
  } catch {
    return false;
  }
}

// Step 1 of "Add regatta from a link": figures out what kind of link this
// is and pulls together whatever it can. A CrewTimer link gets the full
// treatment (title/date/icon + the heat sheet for our own boats); anything
// else falls back to a plain <title>/favicon scrape of that page, since
// there's no public API for e.g. RegattaCentral to pull a schedule from —
// the coach fills in the rest by hand from there.
export async function previewRegattaUrl(formData: FormData): Promise<RegattaUrlPreview> {
  const supabase = await createClient();
  await requireManager(supabase);

  const input = String(formData.get("url") ?? "").trim();
  if (!input) throw new Error("Paste a link first.");

  const mobileId = extractCrewTimerMobileId(input);
  if (mobileId) {
    const preview = await fetchCrewTimerRegattaPreview(mobileId);
    if (preview) {
      return {
        title: preview.title,
        iconUrl: preview.iconUrl,
        startsAtDate: preview.date,
        crewtimerMobileId: mobileId,
        raceRows: preview.raceRows,
        note: null,
      };
    }
    // Looked like a CrewTimer ID but nothing came back for it (wrong ID,
    // or CrewTimer's down) — fall through to a generic page scrape rather
    // than failing outright.
  }

  if (isRegattaCentralUrl(input)) {
    return {
      title: null,
      iconUrl: null,
      startsAtDate: null,
      crewtimerMobileId: null,
      raceRows: [],
      note: "RegattaCentral blocks automatic lookups — paste the regatta's own website link instead for a title/icon, or just fill in the details below by hand.",
    };
  }

  if (/^https?:\/\//i.test(input)) {
    const meta = await fetchUrlMeta(input);
    return {
      title: meta.title,
      iconUrl: meta.iconUrl,
      startsAtDate: null,
      crewtimerMobileId: null,
      raceRows: [],
      note: null,
    };
  }

  throw new Error("That doesn't look like a link — paste the regatta's website or CrewTimer link.");
}

// Step 2: the coach has reviewed/edited the preview, so actually create the
// event and (for a CrewTimer regatta) import its heat sheet the same way a
// manual Excel upload would via importRaces().
export async function createRegattaFromPreview(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const title = String(formData.get("title") ?? "").trim();
  const startsAtDateRaw = String(formData.get("starts_at_date") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const iconUrl = String(formData.get("icon_url") ?? "").trim() || null;
  const crewtimerMobileId = String(formData.get("crewtimer_mobile_id") ?? "").trim() || null;
  const raceRowsRaw = String(formData.get("race_rows_json") ?? "").trim();

  if (!title || !startsAtDateRaw) throw new Error("Title and date are required.");

  // No clock time is asked for here — regattas made this way don't have one
  // (CrewTimer doesn't expose a start time at the regatta level) — noon
  // keeps the stored date from flipping to the day before/after once it
  // round-trips through UTC.
  const startsAt = new Date(`${startsAtDateRaw}T12:00:00`);
  if (isNaN(startsAt.getTime())) throw new Error("Couldn't read that date.");

  const { data: inserted, error } = await supabase
    .from("schedule_events")
    .insert({
      title,
      location,
      event_type: "regatta",
      starts_at: startsAt.toISOString(),
      recurrence: "none",
      created_by: user.id,
      crewtimer_mobile_id: crewtimerMobileId,
      icon_url: iconUrl,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const eventId = (inserted as { id: string }).id;

  if (raceRowsRaw) {
    let raceRows: unknown;
    try {
      raceRows = JSON.parse(raceRowsRaw);
    } catch {
      raceRows = null;
    }
    if (Array.isArray(raceRows) && raceRows.length > 0) {
      await importRaces(eventId, raceRows as CrewTimerRaceRow[]);
    }
  }

  revalidatePath("/schedule/regatta");
  revalidatePath("/schedule");
  revalidatePath("/lineups");
  return { eventId };
}

export async function markScheduleViewed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("schedule_views")
    .upsert({ user_id: user.id, last_viewed_at: new Date().toISOString() });
}
