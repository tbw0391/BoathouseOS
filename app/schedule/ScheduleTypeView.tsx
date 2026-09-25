import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { EventType, Lineup, Role, ScheduleEvent } from "@/lib/database.types";
import { createScheduleEvent } from "./actions";
import { EventCard } from "./EventCard";
import { AddRegattaFromUrlForm } from "./AddRegattaFromUrlForm";

export async function ScheduleTypeView({ eventType, label }: { eventType: EventType; label: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();
  const callerRole = (callerProfile as { role: Role } | null)?.role;
  const canManage = callerRole === "admin" || callerRole === "coach";

  const { data: eventsData } = await supabase
    .from("schedule_events")
    .select("*")
    .eq("event_type", eventType)
    .order("starts_at", { ascending: true });
  const events = (eventsData as ScheduleEvent[] | null) ?? [];

  // A medal shows on a regatta once one of our boats there has a recorded
  // top-3 finish — the best (lowest) place across all its boats.
  const { data: lineupsData } =
    eventType === "regatta" && events.length > 0
      ? await supabase
          .from("lineups")
          .select("event_id, place")
          .in(
            "event_id",
            events.map((e) => e.id)
          )
          .not("place", "is", null)
      : { data: [] as Pick<Lineup, "event_id" | "place">[] };
  const bestPlaceByEventId = new Map<string, number>();
  for (const l of (lineupsData as Pick<Lineup, "event_id" | "place">[] | null) ?? []) {
    if (l.place == null || !l.event_id) continue;
    const current = bestPlaceByEventId.get(l.event_id);
    if (current === undefined || l.place < current) bestPlaceByEventId.set(l.event_id, l.place);
  }

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now.getTime());
  const past = events
    .filter((e) => new Date(e.starts_at).getTime() < now.getTime())
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  return (
    <div className="min-h-screen p-8">
      <Link href="/schedule" className="text-sm text-gray-500 hover:underline">
        ← Schedule
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">{label}</h1>

      {canManage && eventType === "regatta" && (
        <div className="max-w-lg flex flex-col">
          <AddRegattaFromUrlForm />
        </div>
      )}

      {canManage && (
        <form
          action={createScheduleEvent}
          className="flex flex-col gap-3 rounded-lg border p-4 mb-6 max-w-lg"
        >
          <h2 className="text-sm font-medium text-gray-600">New {label.toLowerCase()} event</h2>
          <input type="hidden" name="event_type" value={eventType} />
          <input
            name="title"
            required
            placeholder="Event title"
            className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
          />
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Starts
            <input
              type="datetime-local"
              name="starts_at"
              required
              className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Ends (optional)
            <input
              type="datetime-local"
              name="ends_at"
              className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <input
            name="location"
            placeholder="Location (optional)"
            className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
          />
          <textarea
            name="description"
            rows={3}
            placeholder="Details (optional)"
            className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
          />
          {eventType === "regatta" && (
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              CrewTimer mobile ID (optional)
              <input
                name="crewtimer_mobile_id"
                placeholder="e.g. r12967"
                className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
              />
              <span className="text-xs text-gray-400">
                From this regatta&apos;s crewtimer.com results link. Once set, race results for our
                coxed boats fill in automatically on the Lineups page.
              </span>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Repeats
            <select
              name="recurrence"
              defaultValue="none"
              className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
            >
              <option value="none">Doesn&apos;t repeat</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <button
            type="submit"
            className="self-start rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Add event
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {upcoming.length ? (
          upcoming.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              eventType={eventType}
              canManage={canManage}
              medalPlace={bestPlaceByEventId.get(event.id) ?? null}
            />
          ))
        ) : (
          <p className="text-sm text-gray-500">Nothing scheduled yet.</p>
        )}
      </div>

      {past.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-black">
            Past events ({past.length})
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {past.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                eventType={eventType}
                canManage={canManage}
                medalPlace={bestPlaceByEventId.get(event.id) ?? null}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
