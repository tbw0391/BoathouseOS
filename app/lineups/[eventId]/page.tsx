import Link from "next/link";
import { notFound } from "next/navigation";
import { EventTasks } from "@/app/coach/tasks/EventTasks";
import { ordinalPlace, placeEmoji } from "@/lib/raceResults";
import { cookies } from "next/headers";
import { DEMO_CLUB_COOKIE, findDemoClub, visibleToClub } from "@/lib/demoClubs";
import { HOTC, getHotcSchedule } from "@/lib/hotc";
import { syncHotcResults } from "@/lib/hotcResults";
import { crewTimerResultsFor, syncCrewTimerPlaces } from "@/lib/crewTimerResults";
import { crewTimerFeedUrl } from "@/lib/crewtimer";
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
  TrailerItem,
  RegattaTravel,
  TravelRider,
  TravelRoom,
  TravelRoomMember,
  TravelVehicle,
} from "@/lib/database.types";
import { LINEUP_CATEGORIES, LINEUP_CATEGORY_TEAM } from "@/lib/lineupCategories";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { OAR_COLORS_KEY, boatOarSet, parseOarSettings, tapeSwatch } from "@/lib/oarSheet";
import { resolveLineupSectionVisibility } from "@/lib/lineupSections";
import { parseStarredLines } from "@/lib/scheduleStars";
import type { RaceBoxItem, RaceBoxState } from "../raceBoxTypes";
import { EventRacesView } from "../EventRacesView";
import { CourseEditor } from "../CourseEditor";
import { TrailerList } from "../TrailerList";
import { TravelTab, type RoomView, type VehicleView } from "../TravelTab";
import type { LatLng } from "@/lib/course";
import { markRegattaPrepSeen } from "@/lib/regattaPrep";
import { DeleteRegattaButton } from "../DeleteRegattaButton";
import { LinkCrewTimerResults } from "../LinkCrewTimerResults";

// Trip details, rides and rooms, plus who the viewer can sign up (themself
// and any rower they're a guardian of) and who can be given a room.
async function travelFor(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, userId: string) {
  const [{ data: tripRow }, { data: vehicleRows }, { data: riderRows }, { data: roomRows }, { data: memberRows }, { data: linkRows }, { data: rosterRows }] =
    await Promise.all([
      supabase.from("regatta_travel").select("*").eq("event_id", eventId).maybeSingle(),
      supabase.from("travel_vehicles").select("*").eq("event_id", eventId).order("created_at"),
      supabase.from("travel_riders").select("*").eq("event_id", eventId),
      supabase.from("travel_rooms").select("*").eq("event_id", eventId).order("created_at"),
      supabase.from("travel_room_members").select("*").eq("event_id", eventId),
      supabase.from("family_links").select("rower_id").eq("guardian_id", userId),
      supabase
        .from("profiles")
        .select("id, display_name, role")
        .is("disabled_at", null)
        .not("approved_at", "is", null)
        .order("display_name"),
    ]);
  const people = (rosterRows as { id: string; display_name: string; role: string }[] | null) ?? [];
  const nameById = new Map(people.map((p) => [p.id, p.display_name]));
  const person = (id: string) => ({ id, name: nameById.get(id) ?? "Someone" });
  const riders = (riderRows as TravelRider[] | null) ?? [];
  const members = (memberRows as TravelRoomMember[] | null) ?? [];

  // SafeSport travel consent (0127): riders who are already seated but whose
  // ride no longer qualifies (say someone left and a rower is now alone with
  // the driver, or their consent ran out).
  const problems = await Promise.all(
    riders.map(async (r) => {
      const { data } = await supabase.rpc("travel_consent_problem", {
        vehicle: r.vehicle_id,
        person: r.profile_id,
        adding: false,
      });
      return { vehicleId: r.vehicle_id, problem: (data as string | null) ?? null };
    })
  );
  const vehicles: VehicleView[] = ((vehicleRows as TravelVehicle[] | null) ?? []).map((v) => ({
    ...v,
    driverName: v.driver_id ? (nameById.get(v.driver_id) ?? null) : null,
    riders: riders.filter((r) => r.vehicle_id === v.id).map((r) => person(r.profile_id)),
    warnings: problems
      .filter((p) => p.vehicleId === v.id && p.problem)
      .map((p) => (p.problem as string).replace(/^SafeSport: /, "")),
  }));
  const rooms: RoomView[] = ((roomRows as TravelRoom[] | null) ?? []).map((r) => ({
    ...r,
    members: members.filter((m) => m.room_id === r.id).map((m) => person(m.profile_id)),
  }));
  const kids = ((linkRows as { rower_id: string }[] | null) ?? []).map((l) => person(l.rower_id));

  return {
    trip: (tripRow as RegattaTravel | null) ?? null,
    vehicles,
    rooms,
    myPeople: [person(userId), ...kids],
    roster: people
      .filter((p) => ["rower", "coxswain", "coach"].includes(p.role))
      .map((p) => ({ id: p.id, name: p.display_name })),
  };
}

type EventRow = Pick<
  ScheduleEvent,
  "id" | "title" | "location" | "starts_at" | "start_lat" | "start_lng" | "finish_lat" | "finish_lng"
>;

function pointsOf(e: EventRow) {
  return {
    start: e.start_lat != null && e.start_lng != null ? { lat: e.start_lat, lng: e.start_lng } : null,
    finish: e.finish_lat != null && e.finish_lng != null ? { lat: e.finish_lat, lng: e.finish_lng } : null,
  };
}

// This regatta's start and finish. With none set yet, borrows the course
// from the latest other regatta at the same location (courses rarely move
// year to year). The map opens on the regatta's weather location otherwise.
async function courseFor(supabase: Awaited<ReturnType<typeof createClient>>, event: EventRow) {
  const own = pointsOf(event);
  let borrowedFrom: string | null = null;
  let { start, finish } = own;

  if (!start && !finish && event.location) {
    const { data } = await supabase
      .from("schedule_events")
      .select("id, title, location, starts_at, start_lat, start_lng, finish_lat, finish_lng")
      .eq("location", event.location)
      .neq("id", event.id)
      .or("start_lat.not.is.null,finish_lat.not.is.null")
      .order("starts_at", { ascending: false })
      .limit(1);
    const other = (data as EventRow[] | null)?.[0];
    if (other) {
      ({ start, finish } = pointsOf(other));
      borrowedFrom = `${other.title} (${new Date(other.starts_at).getFullYear()})`;
    }
  }

  let center: LatLng = { lat: 39.8, lng: -82.9 };
  if (!start && !finish) {
    const { data: forecast } = await supabase
      .from("event_forecasts")
      .select("latitude, longitude")
      .eq("event_id", event.id)
      .maybeSingle();
    const f = forecast as { latitude: number | null; longitude: number | null } | null;
    if (f?.latitude != null && f.longitude != null) center = { lat: f.latitude, lng: f.longitude };
  }

  return { start, finish, borrowedFrom, center };
}

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
  const tab =
    tabParam === "jobs" ||
    tabParam === "results" ||
    tabParam === "course" ||
    tabParam === "trailer" ||
    tabParam === "travel"
      ? tabParam
      : "races";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await markRegattaPrepSeen(supabase, user.id, "lineups", [eventId]);

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

  // Any other regatta linked to CrewTimer (0131): live places and times for
  // the Results tab, copied onto lineups too before they're read below.
  const isHotc = typedEvent.title === HOTC.title;
  const crewTimerRaces = isHotc ? null : await crewTimerResultsFor(typedEvent);
  if (canManage && crewTimerRaces) await syncCrewTimerPlaces(supabase, eventId, crewTimerRaces);
  const crewTimerPage = typedEvent.crewtimer_url
    ? crewTimerFeedUrl(typedEvent.crewtimer_url)?.replace(
        /^https:\/\/crewtimer-results\.firebaseio\.com\/results\/(r\d+)\.json$/,
        "https://www.crewtimer.com/regatta/$1"
      ) ?? null
    : null;
  const { data: myClub } =
    canManage && tab === "results" ? await supabase.from("clubs").select("name").maybeSingle() : { data: null };

  const { data: settingsData } = await supabase
    .from("club_settings")
    .select("key, value")
    .in("key", ["lineup_section_visibility", OAR_COLORS_KEY]);
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

  const { data: oarData } = lineups.length
    ? await supabase
        .from("lineup_oars")
        .select("lineup_id, tape_color, rings")
        .in(
          "lineup_id",
          lineups.map((l) => l.id)
        )
    : { data: [] };
  const oarRows = (oarData as { lineup_id: string; tape_color: string; rings: number }[] | null) ?? [];
  const tapeColors = parseOarSettings(settingsByKey.get(OAR_COLORS_KEY)).colors;
  const oarsFor = (lineupId: string) => {
    const set = boatOarSet(oarRows.filter((o) => o.lineup_id === lineupId));
    return set ? { ...set, swatch: tapeSwatch(set.tape_color, tapeColors) } : null;
  };

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
      oars: lineup ? oarsFor(lineup.id) : null,
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
      oars: oarsFor(lineup.id),
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
    {
      id: "results",
      label: (() => {
        const n = crewTimerRaces ? crewTimerRaces.filter((r) => r.place != null).length : finished.length;
        return n > 0 ? `Results (${n})` : "Results";
      })(),
    },
    { id: "travel", label: "Travel" },
    { id: "trailer", label: "Trailer" },
    { id: "course", label: "Course" },
  ];

  let trailer: { items: TrailerItem[]; nameById: Record<string, string> } | null = null;
  if (tab === "trailer") {
    const { data: itemRows } = await supabase
      .from("trailer_items")
      .select("*")
      .eq("event_id", eventId)
      .order("sort", { ascending: true });
    const items = (itemRows as TrailerItem[] | null) ?? [];
    const packerIds = [
      ...new Set(items.flatMap((i) => [i.packed_out_by, i.packed_home_by]).filter((id): id is string => !!id)),
    ];
    const { data: packerRows } = packerIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", packerIds)
      : { data: [] };
    trailer = {
      items,
      nameById: Object.fromEntries(
        ((packerRows as { id: string; display_name: string }[] | null) ?? []).map((p) => [p.id, p.display_name])
      ),
    };
  }

  const course = tab === "course" ? await courseFor(supabase, typedEvent) : null;
  const travel = tab === "travel" && user ? await travelFor(supabase, eventId, user.id) : null;

  return (
    <div className="min-h-screen p-8">
      <Link href="/lineups" className="text-sm text-gray-500 hover:underline">
        ← Lineups
      </Link>
      <h1 className="text-2xl font-bold mt-4">{typedEvent.title}</h1>
      <p className="text-sm text-gray-500 mb-4">{new Date(typedEvent.starts_at).toLocaleDateString()}</p>
      {canManage && typedEvent.event_type === "regatta" && (
        <div className="mb-4">
          <DeleteRegattaButton eventId={eventId} title={typedEvent.title} />
        </div>
      )}

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
          crewTimerName={findDemoClub((await cookies()).get(DEMO_CLUB_COOKIE)?.value)?.name ?? null}
          initialSelectedKey={selectedRaceId ? `race:${selectedRaceId}` : null}
        />
      )}

      {tab === "jobs" && <EventTasks eventId={eventId} canManage={canManage} />}

      {travel && user && (
        <TravelTab eventId={eventId} canManage={canManage} meId={user.id} {...travel} />
      )}

      {trailer && (
        <TrailerList eventId={eventId} items={trailer.items} nameById={trailer.nameById} canManage={canManage} />
      )}

      {course && (
        <CourseEditor
          key={`${course.start?.lat},${course.start?.lng},${course.finish?.lat},${course.finish?.lng}`}
          eventId={eventId}
          canManage={canManage}
          savedStart={course.start}
          savedFinish={course.finish}
          borrowedFrom={course.borrowedFrom}
          center={course.center}
        />
      )}

      {tab === "results" && crewTimerRaces && (
        <div className="flex flex-col gap-2 max-w-lg">
          {crewTimerRaces.length === 0 ? (
            <p className="text-sm text-gray-500">
              No entries for {typedEvent.crewtimer_crew} on CrewTimer yet.
            </p>
          ) : (
            [...crewTimerRaces]
              .sort((a, b) => {
                if (a.place != null && b.place == null) return -1;
                if (a.place == null && b.place != null) return 1;
                return Number(a.eventNum) - Number(b.eventNum) || (a.place ?? 0) - (b.place ?? 0);
              })
              .map((r) => (
                <div
                  key={`${r.eventNum}-${r.bow ?? r.crew}`}
                  className="flex items-center gap-3 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm"
                >
                  <span className="w-14 shrink-0 text-lg">
                    {r.place != null ? `${placeEmoji(r.place)} ${ordinalPlace(r.place)}` : "⏳"}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      Race {r.eventNum}: {r.eventName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {r.crew}
                      {r.bow && ` · Bow ${r.bow}`}
                      {r.place != null
                        ? ` · of ${r.entryCount}${r.time ? ` · ${r.time}` : ""}${r.penalty ? ` · ${r.penalty}` : ""}`
                        : r.start
                          ? ` · starts ${r.start}`
                          : " · not finished yet"}
                    </p>
                  </div>
                </div>
              ))
          )}
          <p className="text-xs text-gray-500">Places and times come in live from CrewTimer as boats finish.</p>
          {crewTimerPage && (
            <a href={crewTimerPage} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 underline">
              Full results on CrewTimer →
            </a>
          )}
          {canManage && (
            <LinkCrewTimerResults
              eventId={eventId}
              savedLink={typedEvent.crewtimer_url}
              savedCrew={typedEvent.crewtimer_crew}
              defaultCrew={(myClub as { name: string } | null)?.name ?? ""}
            />
          )}
        </div>
      )}

      {tab === "results" && !crewTimerRaces && (
        <div className="flex flex-col gap-2 max-w-lg">
          {typedEvent.crewtimer_url && !isHotc && (
            <p className="text-sm text-amber-700">Couldn&apos;t reach CrewTimer right now. Pull down to try again.</p>
          )}
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
          {canManage && !isHotc && (
            <LinkCrewTimerResults
              eventId={eventId}
              savedLink={typedEvent.crewtimer_url}
              savedCrew={typedEvent.crewtimer_crew}
              defaultCrew={(myClub as { name: string } | null)?.name ?? ""}
            />
          )}
        </div>
      )}
    </div>
  );
}
