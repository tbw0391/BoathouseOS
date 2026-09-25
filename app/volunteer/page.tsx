import Link from "next/link";
import { Sailboat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ScheduleEvent, VolunteerNeed, VolunteerSignup } from "@/lib/database.types";

export default async function VolunteerPage() {
  const supabase = await createClient();

  const { data: eventsData } = await supabase
    .from("schedule_events")
    .select("*")
    .eq("event_type", "regatta")
    .order("starts_at", { ascending: true });
  const events = (eventsData as ScheduleEvent[] | null) ?? [];

  const { data: needsData } = await supabase.from("volunteer_needs").select("*");
  const needs = (needsData as VolunteerNeed[] | null) ?? [];

  const { data: signupsData } = await supabase.from("volunteer_signups").select("*");
  const signups = (signupsData as VolunteerSignup[] | null) ?? [];

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now.getTime());
  const past = events
    .filter((e) => new Date(e.starts_at).getTime() < now.getTime())
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  function openSlotsFor(eventId: string) {
    const eventNeeds = needs.filter((n) => n.event_id === eventId);
    if (eventNeeds.length === 0) return null;
    const open = eventNeeds.reduce((total, need) => {
      const filled = signups.filter((s) => s.need_id === need.id).length;
      return total + Math.max(0, need.slots_needed - filled);
    }, 0);
    return open;
  }

  function EventButton({ event, past }: { event: ScheduleEvent; past?: boolean }) {
    const open = openSlotsFor(event.id);
    return (
      <Link
        href={`/volunteer/${event.id}`}
        className={
          past
            ? "flex items-center justify-between gap-2 rounded-lg border-2 border-gray-300 text-gray-400 px-6 py-5 hover:bg-gray-100 transition-colors"
            : "flex items-center justify-between gap-2 rounded-lg border-2 border-[var(--color-primary)] px-6 py-5 hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
        }
      >
        <span className="flex items-center gap-2 text-lg font-medium">
          <Sailboat className="w-7 h-7 shrink-0" />
          {event.title}
        </span>
        <span className={past ? "text-base text-gray-400 text-right" : "text-base text-gray-500 text-right"}>
          {new Date(event.starts_at).toLocaleDateString()}
          {open !== null && (
            <>
              <br />
              {open > 0 ? `${open} slot${open === 1 ? "" : "s"} still open` : "All slots filled"}
            </>
          )}
        </span>
      </Link>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Volunteer Needs</h1>

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-sm text-gray-500">No regatta days set up yet.</p>
      )}

      <div className="flex flex-col gap-3 w-full">
        {upcoming.map((event) => (
          <EventButton key={event.id} event={event} />
        ))}
      </div>

      {past.length > 0 && (
        <details className="mt-8 w-full">
          <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-black">
            Past regattas ({past.length})
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {past.map((event) => (
              <EventButton key={event.id} event={event} past />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
