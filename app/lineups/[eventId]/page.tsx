import { notFound } from "next/navigation";
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
import { getOrRefreshCrewTimerResults } from "@/lib/crewtimer";
import type { RaceBoxItem, RaceBoxState } from "../raceBoxTypes";
import { EventRacesView } from "../EventRacesView";

export default async function EventRacesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
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
  const races = (racesData as Race[] | null) ?? [];
  const lineups = (lineupsData as Lineup[] | null) ?? [];
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

  // Opportunistic, coach/admin-gated (matches who's allowed to write
  // lineups.place/result_time under RLS) — same refresh-on-page-load
  // pattern as the home page's weather cache.
  if (canManage && typedEvent.crewtimer_mobile_id) {
    await getOrRefreshCrewTimerResults(supabase, typedEvent, lineups, seats);
  }

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
  const starredCount = starredNames.filter((name) => !existingRaceNames.has(name)).length;

  return (
    <EventRacesView
      eventId={eventId}
      eventTitle={typedEvent.title}
      eventDate={new Date(typedEvent.starts_at).toLocaleDateString()}
      items={items}
      boats={boats}
      canManage={canManage}
      starredCount={canManage ? starredCount : 0}
    />
  );
}
