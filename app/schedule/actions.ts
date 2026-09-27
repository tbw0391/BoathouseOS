"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { activeMemberIds, formatAlertTime, sendPush } from "@/lib/push";
import type { EventType, Role, ScheduleRecurrence } from "@/lib/database.types";

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

  if (!title || !startsAtRaw) throw new Error("Title and start date/time are required.");

  const startsAt = new Date(startsAtRaw).toISOString();
  const { error } = await supabase.from("schedule_events").insert({
    title,
    description,
    location,
    event_type,
    starts_at: startsAt,
    ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
    recurrence,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/schedule/${event_type}`);
  revalidatePath("/schedule");
  after(async () =>
    sendPush((await activeMemberIds()).filter((id) => id !== user.id), {
      kind: "schedule_new",
      title: `New on the schedule: ${title}`,
      body: [formatAlertTime(startsAt), location].filter(Boolean).join(" · "),
      url: scheduleUrl(event_type),
    })
  );
}

function scheduleUrl(eventType: string) {
  return eventType === "practice" || eventType === "regatta" ? `/schedule/${eventType}` : "/schedule";
}

export async function updateScheduleEvent(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

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

  if (!eventId) throw new Error("Missing event.");
  if (!title || !startsAtRaw) throw new Error("Title and start date/time are required.");

  const { data: before } = await supabase
    .from("schedule_events")
    .select("starts_at, location")
    .eq("id", eventId)
    .single();
  const startsAt = new Date(startsAtRaw).toISOString();

  const { error } = await supabase
    .from("schedule_events")
    .update({
      title,
      description,
      location,
      starts_at: startsAt,
      ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
      recurrence,
    })
    .eq("id", eventId);

  if (error) throw new Error(error.message);

  if (eventType) revalidatePath(`/schedule/${eventType}`);
  revalidatePath("/schedule");

  // Only a new time or place is worth an alert, not a reworded description.
  const old = before as { starts_at: string; location: string | null } | null;
  const timeChanged = old && new Date(old.starts_at).getTime() !== new Date(startsAt).getTime();
  const placeChanged = old && (old.location ?? null) !== location;
  if (timeChanged || placeChanged) {
    after(async () =>
      sendPush((await activeMemberIds()).filter((id) => id !== user.id), {
        kind: "schedule_change",
        title: `Schedule change: ${title}`,
        body: [
          timeChanged ? `Now ${formatAlertTime(startsAt)}` : null,
          placeChanged ? (location ? `At ${location}` : "Location removed") : null,
        ]
          .filter(Boolean)
          .join(" · "),
        url: scheduleUrl(eventType),
        tag: `event-${eventId}`,
      })
    );
  }
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

// Sets (or, with an empty url, clears) a regatta's logo. The file itself is
// uploaded from the browser straight to the regatta-artwork bucket; this only
// records where it landed, so it only accepts a URL in that bucket.
export async function setRegattaArtwork(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const eventId = String(formData.get("event_id") ?? "").trim();
  const url = String(formData.get("artwork_url") ?? "").trim() || null;
  if (!eventId) throw new Error("Missing event.");
  if (url && !url.includes("/storage/v1/object/public/regatta-artwork/")) {
    throw new Error("That image didn't upload correctly.");
  }

  const { error } = await supabase.from("schedule_events").update({ artwork_url: url }).eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath("/schedule/regatta");
  revalidatePath("/schedule");
  revalidatePath("/roster", "layout");
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
