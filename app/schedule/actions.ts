"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

  const { error } = await supabase.from("schedule_events").insert({
    title,
    description,
    location,
    event_type,
    starts_at: new Date(startsAtRaw).toISOString(),
    ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
    recurrence,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/schedule/${event_type}`);
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
