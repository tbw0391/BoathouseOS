import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { EventType, Role, ScheduleEvent } from "@/lib/database.types";
import { createScheduleEvent, deleteScheduleEvent } from "./actions";

const RECURRENCE_LABEL: Record<ScheduleEvent["recurrence"], string> = {
  none: "",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function formatWhen(startsAt: string, endsAt: string | null) {
  const start = new Date(startsAt);
  const startLabel = start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  if (!endsAt) return startLabel;
  const end = new Date(endsAt);
  const endLabel = end.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${startLabel} – ${endLabel}`;
}

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

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now.getTime());
  const past = events
    .filter((e) => new Date(e.starts_at).getTime() < now.getTime())
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  function EventCard({ event }: { event: ScheduleEvent }) {
    const recurrenceLabel = RECURRENCE_LABEL[event.recurrence];
    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-medium">{event.title}</h3>
          <span className="whitespace-nowrap text-xs text-gray-500">
            {formatWhen(event.starts_at, event.ends_at)}
          </span>
        </div>
        {recurrenceLabel && (
          <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase text-gray-600">
            {recurrenceLabel}
          </span>
        )}
        {event.location && <p className="mt-1 text-xs text-gray-500">{event.location}</p>}
        {event.description && (
          <div className="mt-2 text-sm text-gray-600">
            {event.description.split("\n").map((line, i) =>
              line.trimEnd().endsWith("★") ? (
                <p key={i} className="rounded bg-yellow-100 px-1 font-semibold text-gray-900">
                  {line}
                </p>
              ) : (
                <p key={i}>{line || " "}</p>
              )
            )}
          </div>
        )}
        {canManage && (
          <form action={deleteScheduleEvent} className="mt-3 border-t pt-3">
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="event_type" value={eventType} />
            <button type="submit" className="text-xs font-medium text-red-600 hover:text-red-700">
              Delete event
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <Link href="/schedule" className="text-sm text-gray-500 hover:underline">
        ← Schedule
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">{label}</h1>

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
            className="rounded-md border px-3 py-2 outline-none focus:border-[#022e5d]"
          />
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Starts
            <input
              type="datetime-local"
              name="starts_at"
              required
              className="rounded-md border px-3 py-2 outline-none focus:border-[#022e5d]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Ends (optional)
            <input
              type="datetime-local"
              name="ends_at"
              className="rounded-md border px-3 py-2 outline-none focus:border-[#022e5d]"
            />
          </label>
          <input
            name="location"
            placeholder="Location (optional)"
            className="rounded-md border px-3 py-2 outline-none focus:border-[#022e5d]"
          />
          <textarea
            name="description"
            rows={3}
            placeholder="Details (optional)"
            className="rounded-md border px-3 py-2 outline-none focus:border-[#022e5d]"
          />
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Repeats
            <select
              name="recurrence"
              defaultValue="none"
              className="rounded-md border px-3 py-2 outline-none focus:border-[#022e5d]"
            >
              <option value="none">Doesn&apos;t repeat</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <button
            type="submit"
            className="self-start rounded-md bg-[#022e5d] px-4 py-2 text-sm font-medium text-white"
          >
            Add event
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {upcoming.length ? (
          upcoming.map((event) => <EventCard key={event.id} event={event} />)
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
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
