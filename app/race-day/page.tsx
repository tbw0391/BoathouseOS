import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSelectedClubSlug, visibleToClub } from "@/lib/demoClubs";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { ordinalPlace, placeEmoji } from "@/lib/raceResults";
import {
  LAUNCH_MINUTES_KEY,
  clubDateKey,
  clubTimeLabel,
  launchTime,
  parseLaunchMinutes,
  pickRaceDayEvent,
  raceIsOver,
  seatLabel,
} from "@/lib/raceDay";
import type { Lineup, LineupSeat, Profile, ScheduleEvent } from "@/lib/database.types";
import { BowNumberEditor, LaunchMinutesPicker } from "./RaceDayControls";

// Everything a crew needs on race day: each race with its launch time, bow
// number and crew, soonest first. Rowers and coxswains see their own races,
// parents their rowers', coaches and admins every club boat.
export default async function RaceDayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, spouse_id").eq("id", user.id).single();
  const role = (me as Pick<Profile, "role" | "spouse_id"> | null)?.role;
  const isManager = role === "coach" || role === "admin";

  // Whose races: null = the whole club.
  let followIds: string[] | null = null;
  if (role === "rower" || role === "coxswain") {
    followIds = [user.id];
  } else if (!isManager) {
    const household = [user.id];
    const spouseId = (me as Pick<Profile, "spouse_id"> | null)?.spouse_id;
    if (spouseId) household.push(spouseId);
    const { data: reverse } = await supabase.from("profiles").select("id").eq("spouse_id", user.id);
    household.push(...((reverse as { id: string }[] | null) ?? []).map((p) => p.id));
    const { data: links } = await supabase.from("family_links").select("rower_id").in("guardian_id", household);
    followIds = [...new Set(((links as { rower_id: string }[] | null) ?? []).map((l) => l.rower_id))];
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: eventRows }, { data: settingRow }] = await Promise.all([
    supabase
      .from("schedule_events")
      .select("*")
      .eq("event_type", "regatta")
      .gte("starts_at", yesterday)
      .order("starts_at", { ascending: true })
      .limit(10),
    supabase.from("club_settings").select("value").eq("key", LAUNCH_MINUTES_KEY).maybeSingle(),
  ]);
  const launchMinutes = parseLaunchMinutes((settingRow as { value: string | null } | null)?.value);
  const event = pickRaceDayEvent((eventRows as ScheduleEvent[] | null) ?? []);

  if (!event) {
    return (
      <Shell>
        <p className="text-sm text-gray-600">No regattas coming up on the schedule.</p>
      </Shell>
    );
  }

  const clubSlug = await getSelectedClubSlug();
  const { data: lineupRows } = await supabase.from("lineups").select("*").eq("event_id", event.id);
  let lineups = ((lineupRows as Lineup[] | null) ?? []).filter((l) => visibleToClub(l.club_slug, clubSlug));

  const { data: seatRows } = lineups.length
    ? await supabase
        .from("lineup_seats")
        .select("*")
        .in(
          "lineup_id",
          lineups.map((l) => l.id)
        )
    : { data: [] };
  const seats = (seatRows as LineupSeat[] | null) ?? [];
  if (followIds) {
    const mine = new Set(seats.filter((s) => s.rower_id && followIds!.includes(s.rower_id)).map((s) => s.lineup_id));
    lineups = lineups.filter((l) => mine.has(l.id));
  }
  lineups.sort((a, b) => {
    if (a.race_time && b.race_time) return a.race_time.localeCompare(b.race_time);
    return a.race_time ? -1 : b.race_time ? 1 : (a.race_name ?? "").localeCompare(b.race_name ?? "");
  });

  const rowerIds = [...new Set(seats.map((s) => s.rower_id).filter((id): id is string => !!id))];
  const [{ data: nameRows }, { data: sessionRows }] = await Promise.all([
    rowerIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", rowerIds)
      : Promise.resolve({ data: [] }),
    lineups.length
      ? supabase
          .from("on_water_sessions")
          .select("lineup_id")
          .is("ended_at", null)
          .in(
            "lineup_id",
            lineups.map((l) => l.id)
          )
      : Promise.resolve({ data: [] }),
  ]);
  const nameById = new Map(((nameRows as { id: string; display_name: string }[] | null) ?? []).map((p) => [p.id, p.display_name]));
  const onWater = new Set(((sessionRows as { lineup_id: string | null }[] | null) ?? []).map((s) => s.lineup_id));

  const isToday = clubDateKey(new Date()) >= clubDateKey(event.starts_at);
  const hasCourse = event.start_lat != null || event.finish_lat != null;
  const upcoming = lineups.filter((l) => !raceIsOver(l));
  const done = lineups.filter((l) => raceIsOver(l));

  return (
    <Shell>
      <div className="mb-4">
        <h2 className="text-xl font-bold">{event.title}</h2>
        <p className="text-sm text-gray-600">
          {isToday ? "Today" : new Date(event.starts_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" })}
          {event.location && ` · ${event.location}`}
        </p>
        <div className="flex flex-wrap gap-3 mt-2 text-sm">
          <Link href={`/lineups/${event.id}`} className="underline text-[var(--color-primary)]">
            All races
          </Link>
          {hasCourse && (
            <Link href={`/lineups/${event.id}?tab=course`} className="underline text-[var(--color-primary)]">
              Course map
            </Link>
          )}
          <Link href="/on-water" className="underline text-[var(--color-primary)]">
            On the water
          </Link>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Launch times are {launchMinutes} minutes before each race.
      </p>
      {role === "admin" && <LaunchMinutesPicker current={launchMinutes} />}

      {lineups.length === 0 && (
        <p className="text-sm text-gray-600">
          {followIds && followIds.length === 0
            ? "Link your rower on your profile to see their races here."
            : followIds
              ? "No races here yet. Crews show up once a coach puts them in a lineup."
              : "No lineups for this regatta yet."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {upcoming.map((l) => (
          <RaceCard
            key={l.id}
            lineup={l}
            seats={seats.filter((s) => s.lineup_id === l.id)}
            nameById={nameById}
            followIds={followIds}
            launchMinutes={launchMinutes}
            onWater={onWater.has(l.id)}
            canEdit={isManager}
          />
        ))}
      </div>

      {done.length > 0 && (
        <>
          <h3 className="font-semibold mt-6 mb-2 text-gray-600">Done</h3>
          <div className="flex flex-col gap-2">
            {done.map((l) => (
              <div key={l.id} className="flex items-center gap-3 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm">
                <span className="w-14 shrink-0">
                  {l.place != null ? `${placeEmoji(l.place)} ${ordinalPlace(l.place)}` : "—"}
                </span>
                <span className="min-w-0 truncate">
                  {l.race_name ?? l.boat_name} · {l.boat_name}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← Home
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-4">Race Day</h1>
      {children}
    </div>
  );
}

function RaceCard({
  lineup,
  seats,
  nameById,
  followIds,
  launchMinutes,
  onWater,
  canEdit,
}: {
  lineup: Lineup;
  seats: LineupSeat[];
  nameById: Map<string, string>;
  followIds: string[] | null;
  launchMinutes: number;
  onWater: boolean;
  canEdit: boolean;
}) {
  const rowerSeats = BOAT_CLASSES[lineup.boat_class]?.rowerSeats ?? seats.filter((s) => s.seat_role === "rower").length;
  const ordered = [...seats].sort((a, b) => {
    if (a.seat_role === "coxswain") return -1;
    if (b.seat_role === "coxswain") return 1;
    return b.seat_number - a.seat_number;
  });

  return (
    <div className="rounded-lg border-2 border-[var(--color-primary)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{lineup.race_name ?? lineup.boat_name}</p>
          <p className="text-sm text-gray-600">
            {lineup.boat_name}
            {lineup.boat_class && ` · ${lineup.boat_class}`}
          </p>
        </div>
        {lineup.race_time ? (
          <div className="text-right shrink-0">
            <p className="text-lg font-bold leading-tight">{clubTimeLabel(lineup.race_time)}</p>
            <p className="text-xs text-gray-600">Launch {clubTimeLabel(launchTime(lineup.race_time, launchMinutes))}</p>
          </div>
        ) : (
          <p className="text-xs text-gray-500 shrink-0">Time TBA</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-2">
        {onWater && (
          <span className="text-xs font-medium rounded-full bg-blue-100 text-blue-800 px-2 py-0.5">On the water now</span>
        )}
        {canEdit ? (
          <BowNumberEditor lineupId={lineup.id} current={lineup.bow_number} />
        ) : (
          lineup.bow_number && (
            <span className="text-xs font-medium rounded-full bg-gray-100 px-2 py-0.5">Bow #{lineup.bow_number}</span>
          )
        )}
      </div>

      {ordered.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {ordered.map((s) => {
            const mine = !!s.rower_id && !!followIds?.includes(s.rower_id);
            return (
              <li key={s.id} className="flex gap-2 min-w-0">
                <span className="text-gray-500 w-12 shrink-0">{seatLabel(s, rowerSeats)}</span>
                <span className={`truncate ${mine ? "font-semibold text-[var(--color-primary)]" : ""}`}>
                  {s.rower_id ? (nameById.get(s.rower_id) ?? "—") : "Open"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {lineup.notes && <p className="mt-2 text-sm text-gray-600">{lineup.notes}</p>}
    </div>
  );
}
