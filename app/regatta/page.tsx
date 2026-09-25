import Link from "next/link";
import { cookies } from "next/headers";
import { DEMO_CLUB_COOKIE, findDemoClub } from "@/lib/demoClubs";
import { HOTC, getHotcSchedule, hotcRaceName } from "@/lib/hotc";
import { ordinalPlace, placeEmoji } from "@/lib/raceResults";
import { createClient } from "@/lib/supabase/server";
import { addRegattaRaceToLineups } from "./actions";

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default async function RegattaPage() {
  const club = findDemoClub((await cookies()).get(DEMO_CLUB_COOKIE)?.value);

  if (!club) {
    return (
      <div className="min-h-screen p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{HOTC.title}</h1>
        <p className="text-sm text-gray-600 mb-4">Pick your club to see its races.</p>
        <Link
          href="/choose-club"
          className="inline-block bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded-lg px-4 py-2 font-medium"
        >
          Pick your club
        </Link>
      </div>
    );
  }

  const schedule = await getHotcSchedule(club);

  // Coaches and admins can send any of these races to the Lineups page to
  // put a boat in it; a race already sent shows its boat instead.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const callerRole = (callerProfile as { role: string } | null)?.role;
  const canManage = callerRole === "admin" || callerRole === "coach";

  const sentRaceByName = new Map<string, { eventId: string; raceId: string; boatName: string | null }>();
  if (canManage && schedule?.date) {
    const { data: eventRows } = await supabase
      .from("schedule_events")
      .select("id")
      .eq("title", HOTC.title)
      .gte("starts_at", new Date(`${schedule.date}T00:00:00-04:00`).toISOString())
      .lte("starts_at", new Date(`${schedule.date}T23:59:59-04:00`).toISOString());
    const eventIds = ((eventRows as { id: string }[] | null) ?? []).map((e) => e.id);
    if (eventIds.length > 0) {
      const { data: raceRows } = await supabase
        .from("races")
        .select("id, event_id, race_name, lineups:lineup_id (boat_name)")
        .in("event_id", eventIds);
      for (const r of (raceRows as unknown as {
        id: string;
        event_id: string;
        race_name: string;
        lineups: { boat_name: string } | null;
      }[] | null) ?? []) {
        sentRaceByName.set(r.race_name, { eventId: r.event_id, raceId: r.id, boatName: r.lineups?.boat_name ?? null });
      }
    }
  }

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">{HOTC.title}</h1>
      <p className="text-sm text-gray-600 mt-1 mb-6">
        {schedule?.date && <>{formatDate(schedule.date)} · </>}
        {club.name}&apos;s races. Places and times show up here live as boats finish.
      </p>

      {!schedule && (
        <p className="text-sm text-gray-500">
          Couldn&apos;t reach CrewTimer right now. Pull down to try again.
        </p>
      )}

      {schedule && schedule.races.length === 0 && (
        <p className="text-sm text-gray-500">
          No {club.name} entries found in the {HOTC.title} race schedule.
        </p>
      )}

      {schedule && schedule.races.length > 0 && (
        <div className="flex flex-col gap-3">
          {schedule.races.map((race, i) => (
            <div
              key={`${race.eventNum}-${race.bow ?? i}`}
              className="flex items-start gap-3 border-2 border-[var(--color-primary)] rounded-lg px-4 py-3"
            >
              <div className="w-16 shrink-0 text-sm font-semibold text-[var(--color-primary)]">
                {race.start ?? "TBD"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  Race {race.eventNum}: {race.eventName}
                </p>
                <p className="text-sm text-gray-600">
                  {[race.bow && `Bow ${race.bow}`, race.stroke, race.crew !== club.name && race.crew]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {race.penalty && <p className="text-xs text-gray-500 mt-0.5">{race.penalty}</p>}
              </div>
              {canManage && race.place == null && (() => {
                const sent = sentRaceByName.get(hotcRaceName(race));
                return sent ? (
                  <Link
                    href={`/lineups/${sent.eventId}?race=${sent.raceId}`}
                    className="shrink-0 text-sm font-medium text-[var(--color-primary)] underline"
                  >
                    {sent.boatName ? `🚣 ${sent.boatName}` : "Pick a boat"}
                  </Link>
                ) : (
                  <form action={addRegattaRaceToLineups} className="shrink-0">
                    <input type="hidden" name="event_num" value={race.eventNum} />
                    <input type="hidden" name="crew" value={race.crew} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-white bg-[var(--color-secondary)] border-2 border-[var(--color-primary)] rounded px-3 py-1.5"
                    >
                      Add boat
                    </button>
                  </form>
                );
              })()}
              {race.place != null && (
                <div className="shrink-0 text-right">
                  <p className="font-semibold">
                    {placeEmoji(race.place)} {ordinalPlace(race.place)}
                    <span className="text-xs font-normal text-gray-500"> of {race.entryCount}</span>
                  </p>
                  {race.time && <p className="text-sm text-gray-600">{race.time}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <a
        href={HOTC.crewTimerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-6 text-sm text-gray-600 underline"
      >
        Full results on CrewTimer →
      </a>
    </div>
  );
}
