import Link from "next/link";
import { cookies } from "next/headers";
import { DEMO_CLUB_COOKIE, findDemoClub } from "@/lib/demoClubs";
import { HOTC, getHotcSchedule } from "@/lib/hotc";
import { ordinalPlace, placeEmoji } from "@/lib/raceResults";

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
