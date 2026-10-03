import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isPastEvent } from "@/lib/schedule";
import { clubDateLabel, regattaIsFinished } from "@/lib/raceDay";
import { getSelectedClubSlug, visibleToClub } from "@/lib/demoClubs";
import type { Lineup, Race, ScheduleEvent } from "@/lib/database.types";
import { EventIcon } from "@/components/EventIcon";

export default async function LineupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();
  const callerRole = (callerProfile as { role: string } | null)?.role;
  const canManage = callerRole === "admin" || callerRole === "coach";

  const { data: eventsData } = await supabase
    .from("schedule_events")
    .select("*")
    .order("starts_at", { ascending: true });
  const events = (eventsData as ScheduleEvent[] | null) ?? [];

  const { data: lineupsData } = await supabase.from("lineups").select("*");
  const selectedClubSlug = await getSelectedClubSlug();
  const lineups = ((lineupsData as Lineup[] | null) ?? []).filter((l) =>
    visibleToClub(l.club_slug, selectedClubSlug)
  );

  const { data: racesData } = await supabase.from("races").select("*");
  const races = ((racesData as Race[] | null) ?? []).filter((r) => visibleToClub(r.club_slug, selectedClubSlug));

  const eventIdsWithLineups = new Set(lineups.map((l) => l.event_id));
  const eventIdsWithRaces = new Set(races.map((r) => r.event_id));
  const relevantEvents = events.filter(
    (e) =>
      !isPastEvent(e) ||
      eventIdsWithLineups.has(e.id) ||
      eventIdsWithRaces.has(e.id)
  );
  // Finished regattas (every boat has a result, or the day's over) drop
  // below the upcoming ones, most recent first.
  const isFinished = (e: ScheduleEvent) =>
    e.event_type === "regatta" &&
    regattaIsFinished(
      e,
      lineups.filter((l) => l.event_id === e.id)
    );
  const upcoming = relevantEvents
    .filter((e) => !isPastEvent(e) && !isFinished(e))
    .sort((a, b) => {
      const aRegatta = a.event_type === "regatta" ? 0 : 1;
      const bRegatta = b.event_type === "regatta" ? 0 : 1;
      if (aRegatta !== bRegatta) return aRegatta - bRegatta;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });
  const finished = relevantEvents
    .filter((e) => !isPastEvent(e) && isFinished(e))
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  const past = relevantEvents
    .filter((e) => isPastEvent(e))
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  function EventButton({ event }: { event: ScheduleEvent }) {
    const pendingCount = races.filter((r) => r.event_id === event.id && !r.lineup_id).length;
    return (
      <Link
        href={`/lineups/${event.id}`}
        className="flex items-center justify-between gap-2 rounded-lg border-2 border-[var(--color-primary)] px-6 py-5 hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2 text-lg font-medium">
          <EventIcon title={event.title} className="w-7 h-7" />
          {event.title}
        </span>
        <span className="text-base text-gray-500 text-right">
          {clubDateLabel(event.starts_at)}
          {pendingCount > 0 && (
            <>
              <br />
              {pendingCount} need{pendingCount === 1 ? "s" : ""} a lineup
            </>
          )}
        </span>
      </Link>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Lineups</h1>

      {upcoming.length === 0 && finished.length === 0 && past.length === 0 && (
        <p className="text-sm text-gray-500">No events on the schedule yet.</p>
      )}

      <div className="flex flex-col gap-3 w-full">
        {upcoming.map((event) => (
          <EventButton key={event.id} event={event} />
        ))}
      </div>

      {finished.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-medium text-gray-500">Finished</h2>
          <div className="flex flex-col gap-3 w-full">
            {finished.map((event) => (
              <EventButton key={event.id} event={event} />
            ))}
          </div>
        </>
      )}

      {canManage && (
        <Link href="/boats" className="mt-8 inline-block text-sm text-gray-600 underline">
          Boats and saved crews are on the Boats page →
        </Link>
      )}

      {past.length > 0 && (
        <details className="mt-8 w-full">
          <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-black">
            Past ({past.length})
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {past.map((event) => (
              <EventButton key={event.id} event={event} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
