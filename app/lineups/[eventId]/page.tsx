import Link from "next/link";
import { notFound } from "next/navigation";
import { EventTasks } from "@/app/coach/tasks/EventTasks";
import { ordinalPlace, placeEmoji } from "@/lib/raceResults";
import { cookies } from "next/headers";
import { DEMO_CLUB_COOKIE, findDemoClub, visibleToClub } from "@/lib/demoClubs";
import { HOTC, getHotcSchedule } from "@/lib/hotc";
import { syncHotcResults } from "@/lib/hotcResults";
import { createClient } from "@/lib/supabase/server";
import type {
  Boat,
  Lineup,
  LineupCategory,
  LineupSeat,
  Profile,
  ProfileTeam,
  Race,
  ScheduleEvent,
} from "@/lib/database.types";
import { LINEUP_CATEGORIES, LINEUP_CATEGORY_TEAM } from "@/lib/lineupCategories";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { resolveLineupSectionVisibility } from "@/lib/lineupSections";
import { parseStarredLines } from "@/lib/scheduleStars";
import type { RaceBoxItem, RaceBoxState } from "../raceBoxTypes";
import { EventRacesView } from "../EventRacesView";

export default async function EventRacesPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ race?: string; tab?: string }>;
}) {
  const { eventId } = await params;
  // Set when arriving from the Regatta page's "Add boat", to open that race.
  const { race: selectedRaceId, tab: tabParam } = await searchParams;
  const tab = tabParam === "jobs" || tabParam === "results" ? tabParam : "races";
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
  const isAdmin = callerRole === "admin";

  const { data: event } = await supabase
    .from("schedule_events")
    .select("*")
    .eq("id", eventId)
    .single();
  if (!event) notFound();
  const typedEvent = event as ScheduleEvent;

  // Head of the Cuyahoga places come in live from CrewTimer; pick up any new
  // ones before reading this regatta's lineups.
  if (canManage && typedEvent.title === HOTC.title) {
    const club = findDemoClub((await cookies()).get(DEMO_CLUB_COOKIE)?.value);
    if (club) await syncHotcResults(supabase, await getHotcSchedule(club));
  }

  const { data: settingsData } = await supabase
    .from("club_settings")
    .select("key, value")
    .eq("key", "lineup_section_visibility");
  const settingsByKey = new Map(
    ((settingsData as { key: string; value: string | null }[] | null) ?? []).map((s) => [s.key, s.value])
  );
  const sectionVisibilityById = resolveLineupSectionVisibility(settingsByKey);
  function sectionVisible(id: string): boolean {
    if (isAdmin) return true;
    const visibility = sectionVisibilityById[id] ?? "everyone";
    if (visibility === "coaches") return canManage;
    return visibility === "everyone";
  }

  const [{ data: racesData }, { data: lineupsData }, { data: boatsData }, { data: rosterData }, { data: profileTeamsData }] =
    await Promise.all([
      supabase.from("races").select("*").eq("event_id", eventId),
      supabase.from("lineups").select("*").eq("event_id", eventId),
      supabase.from("boats").select("*").order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, display_name")
        .is("disabled_at", null)
        .order("display_name", { ascending: true }),
      supabase.from("profile_teams").select("*"),
    ]);
  // With a club picked, only that club's races and boats (plus untagged ones).
  const selectedClubSlug = findDemoClub((await cookies()).get(DEMO_CLUB_COOKIE)?.value)?.slug ?? null;
  const races = ((racesData as Race[] | null) ?? []).filter((r) => visibleToClub(r.club_slug, selectedClubSlug));
  const lineups = ((lineupsData as Lineup[] | null) ?? []).filter((l) =>
    visibleToClub(l.club_slug, selectedClubSlug)
  );
  const boats = (boatsData as Boat[] | null) ?? [];
  const roster = (rosterData as Pick<Profile, "id" | "display_name">[] | null) ?? [];

  const profileIdsByTeam = new Map<string, Set<string>>();
  for (const row of (profileTeamsData as ProfileTeam[] | null) ?? []) {
    const set = profileIdsByTeam.get(row.team) ?? new Set<string>();
    set.add(row.profile_id);
    profileIdsByTeam.set(row.team, set);
  }
  function rosterForCategory(category: LineupCategory | null) {
    const team = category ? LINEUP_CATEGORY_TEAM[category] : null;
    if (!team) return roster;
    const memberIds = profileIdsByTeam.get(team) ?? new Set<string>();
    return roster.filter((p) => memberIds.has(p.id));
  }

  const { data: seatsData } = lineups.length
    ? await supabase
        .from("lineup_seats")
        .select("*")
        .in(
          "lineup_id",
          lineups.map((l) => l.id)
        )
        .order("seat_number", { ascending: true })
    : { data: [] as LineupSeat[] };
  const seats = (seatsData as LineupSeat[] | null) ?? [];

  function stateForPlace(place: number | null): RaceBoxState {
    if (place === 1) return "gold";
    if (place === 2) return "silver";
    if (place === 3) return "bronze";
    return "assigned";
  }

  function categoryLabel(category: LineupCategory | null, boatClass: string | null) {
    if (category) return LINEUP_CATEGORIES[category] ?? category;
    if (boatClass) return BOAT_CLASSES[boatClass]?.label ?? boatClass;
    return "";
  }

  const lineupsUsedByRace = new Set(
    races.map((r) => r.lineup_id).filter((id): id is string => !!id)
  );

  const items: RaceBoxItem[] = [];

  for (const race of races) {
    const category = race.category as LineupCategory | null;
    if (category && !sectionVisible(LINEUP_CATEGORY_TEAM[category])) continue;

    const lineup = race.lineup_id ? lineups.find((l) => l.id === race.lineup_id) ?? null : null;
    const lineupSeats = lineup
      ? seats
          .filter((s) => s.lineup_id === lineup.id)
          .sort((a, b) =>
            a.seat_role === b.seat_role
              ? a.seat_number - b.seat_number
              : a.seat_role === "coxswain"
                ? -1
                : b.seat_role === "coxswain"
                  ? 1
                  : 0
          )
      : [];

    items.push({
      key: `race:${race.id}`,
      label: race.race_name,
      categoryLabel: categoryLabel(lineup?.category ?? category, lineup?.boat_class ?? null),
      category: (lineup?.category as LineupCategory | null) ?? category,
      state: lineup ? stateForPlace(lineup.place) : "pending",
      raceId: race.lineup_id ? null : race.id,
      lineup,
      lineupSeats,
      eligibleRoster: lineup ? rosterForCategory(lineup.category) : [],
    });
  }

  // A lineup built directly (not from an imported/starred race row) still
  // gets a box, so every boat for this event shows up somewhere.
  for (const lineup of lineups) {
    if (lineupsUsedByRace.has(lineup.id)) continue;
    const category = lineup.category as LineupCategory | null;
    if (category && !sectionVisible(LINEUP_CATEGORY_TEAM[category])) continue;

    const lineupSeats = seats
      .filter((s) => s.lineup_id === lineup.id)
      .sort((a, b) =>
        a.seat_role === b.seat_role
          ? a.seat_number - b.seat_number
          : a.seat_role === "coxswain"
            ? -1
            : b.seat_role === "coxswain"
              ? 1
              : 0
      );

    items.push({
      key: `lineup:${lineup.id}`,
      label: lineup.race_name || lineup.boat_name,
      categoryLabel: categoryLabel(category, lineup.boat_class),
      category,
      state: stateForPlace(lineup.place),
      raceId: null,
      lineup,
      lineupSeats,
      eligibleRoster: rosterForCategory(category),
    });
  }

  items.sort((a, b) => {
    const aTime = a.lineup?.race_time ?? null;
    const bTime = b.lineup?.race_time ?? null;
    if (aTime && bTime) return new Date(aTime).getTime() - new Date(bTime).getTime();
    if (aTime) return -1;
    if (bTime) return 1;
    return a.label.localeCompare(b.label);
  });

  const starredNames = parseStarredLines(typedEvent.description);
  const existingRaceNames = new Set(races.map((r) => r.race_name));
  const pendingStarredLines = starredNames.filter((name) => !existingRaceNames.has(name));

  const finished = items
    .filter((i) => i.lineup?.place != null)
    .sort((a, b) => (a.lineup?.place as number) - (b.lineup?.place as number));
  const needBoat = items.filter((i) => i.state === "pending").length;

  // Everything for one regatta on one page: races and crews, the jobs
  // (Launch/Recovery and the rest), and how every boat finished.
  const tabs = [
    { id: "races", label: needBoat > 0 ? `Races (${needBoat} need a boat)` : `Races (${items.length})` },
    { id: "jobs", label: "Jobs" },
    { id: "results", label: finished.length > 0 ? `Results (${finished.length})` : "Results" },
  ];

  return (
    <div className="min-h-screen p-8">
      <Link href="/lineups" className="text-sm text-gray-500 hover:underline">
        ← Lineups
      </Link>
      <h1 className="text-2xl font-bold mt-4">{typedEvent.title}</h1>
      <p className="text-sm text-gray-500 mb-4">{new Date(typedEvent.starts_at).toLocaleDateString()}</p>

      <nav className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.id === "races" ? `/lineups/${eventId}` : `/lineups/${eventId}?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                : "border-gray-300 hover:border-[var(--color-primary)]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "races" && (
        <EventRacesView
          eventId={eventId}
          items={items}
          boats={boats}
          canManage={canManage}
          pendingStarredLines={canManage ? pendingStarredLines : []}
          hasResultsFeed={typedEvent.title === HOTC.title}
          initialSelectedKey={selectedRaceId ? `race:${selectedRaceId}` : null}
        />
      )}

      {tab === "jobs" && <EventTasks eventId={eventId} canManage={canManage} />}

      {tab === "results" && (
        <div className="flex flex-col gap-2 max-w-lg">
          {finished.length === 0 ? (
            <p className="text-sm text-gray-500">
              No results yet.{" "}
              {typedEvent.title === HOTC.title
                ? "Places fill in here on their own as boats finish."
                : "Open a race on the Races tab to enter its place."}
            </p>
          ) : (
            finished.map((i) => (
              <div key={i.key} className="flex items-center gap-3 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm">
                <span className="text-lg w-14 shrink-0">
                  {placeEmoji(i.lineup?.place as number)} {ordinalPlace(i.lineup?.place as number)}
                </span>
                <div className="min-w-0">
                  <p className="font-medium truncate">{i.label}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {i.lineup?.boat_name}
                    {i.categoryLabel && ` · ${i.categoryLabel}`}
                  </p>
                </div>
              </div>
            ))
          )}
          {typedEvent.title === HOTC.title && (
            <Link href="/regatta" className="mt-2 text-sm text-gray-600 underline">
              Live results and times →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
