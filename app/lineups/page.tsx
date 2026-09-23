import { createClient } from "@/lib/supabase/server";
import type {
  Boat,
  Lineup,
  LineupSeat,
  LineupTemplate,
  LineupTemplateSeat,
  Profile,
  ProfileTeam,
  Race,
  ScheduleEvent,
} from "@/lib/database.types";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES, LINEUP_CATEGORY_OPTIONS, LINEUP_CATEGORY_TEAM } from "@/lib/lineupCategories";
import { resolveLineupSectionVisibility } from "@/lib/lineupSections";
import { BoatsSection } from "./BoatsSection";
import { CreateLineupForm } from "./CreateLineupForm";
import { SeatAssign } from "./SeatAssign";
import { DeleteLineupButton } from "./DeleteLineupButton";
import { EditRaceInfo } from "./EditRaceInfo";
import { EditRaceResult } from "./EditRaceResult";
import { LineupTemplatesSection } from "./LineupTemplatesSection";
import { EventIcon } from "@/components/EventIcon";
import { ImportRacesForm } from "./ImportRacesForm";
import { ImportStarredRacesButton } from "./ImportStarredRacesButton";
import { PendingRaceRow } from "./PendingRaceRow";
import { parseStarredLines } from "@/lib/scheduleStars";

const SEAT_ROLE_LABEL: Record<LineupSeat["seat_role"], string> = {
  rower: "Seat",
  coxswain: "Coxswain",
  coach: "Coach",
};

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
  const isAdmin = callerRole === "admin";

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

  const { data: eventsData } = await supabase
    .from("schedule_events")
    .select("*")
    .order("starts_at", { ascending: true });
  const events = (eventsData as ScheduleEvent[] | null) ?? [];

  const { data: lineupsData } = await supabase
    .from("lineups")
    .select("*")
    .order("created_at", { ascending: true });
  const lineups = (lineupsData as Lineup[] | null) ?? [];

  const { data: boatsData } = await supabase
    .from("boats")
    .select("*")
    .order("name", { ascending: true });
  const boats = (boatsData as Boat[] | null) ?? [];

  const { data: seatsData } = await supabase
    .from("lineup_seats")
    .select("*")
    .order("seat_number", { ascending: true });
  const seats = (seatsData as LineupSeat[] | null) ?? [];

  const { data: racesData } = await supabase
    .from("races")
    .select("*")
    .order("race_time", { ascending: true, nullsFirst: false });
  const races = (racesData as Race[] | null) ?? [];
  const pendingRaces = races.filter((r) => !r.lineup_id);

  const { data: templatesData } = await supabase
    .from("lineup_templates")
    .select("*")
    .order("name", { ascending: true });
  const templates = (templatesData as LineupTemplate[] | null) ?? [];

  const { data: templateSeatsData } = await supabase
    .from("lineup_template_seats")
    .select("*")
    .order("seat_number", { ascending: true });
  const templateSeats = (templateSeatsData as LineupTemplateSeat[] | null) ?? [];

  const { data: rosterData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .is("disabled_at", null)
    .order("display_name", { ascending: true });
  const roster = (rosterData as Pick<Profile, "id" | "display_name">[] | null) ?? [];
  const nameById = new Map(roster.map((p) => [p.id, p.display_name]));

  const { data: profileTeamsData } = await supabase.from("profile_teams").select("*");
  const profileIdsByTeam = new Map<string, Set<string>>();
  for (const row of (profileTeamsData as ProfileTeam[] | null) ?? []) {
    const set = profileIdsByTeam.get(row.team) ?? new Set<string>();
    set.add(row.profile_id);
    profileIdsByTeam.set(row.team, set);
  }

  function rosterForCategory(category: Lineup["category"]) {
    const team = category ? LINEUP_CATEGORY_TEAM[category] : null;
    if (!team) return roster;
    const memberIds = profileIdsByTeam.get(team) ?? new Set<string>();
    return roster.filter((p) => memberIds.has(p.id));
  }

  const eventIdsWithLineups = new Set(lineups.map((l) => l.event_id));
  const eventIdsWithRaces = new Set(races.map((r) => r.event_id));
  const now = new Date();
  const relevantEvents = events.filter(
    (e) =>
      new Date(e.starts_at).getTime() >= now.getTime() ||
      eventIdsWithLineups.has(e.id) ||
      eventIdsWithRaces.has(e.id)
  );
  const upcoming = relevantEvents.filter((e) => new Date(e.starts_at).getTime() >= now.getTime());
  const past = relevantEvents
    .filter((e) => new Date(e.starts_at).getTime() < now.getTime())
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  function LineupCard({ lineup }: { lineup: Lineup }) {
    // Cox rides at the front of the list, matching where they sit in the
    // boat during a race, not sorted in with the numbered rower seats.
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
    const eligibleRoster = rosterForCategory(lineup.category);
    // Once someone's picked for one seat in this boat, they drop out of
    // every other seat's dropdown in the same boat — a boat's own list
    // shrinks as it fills in, but stays full for every other boat.
    const assignedInThisBoatIds = new Set(
      lineupSeats.map((s) => s.rower_id).filter((id): id is string => !!id)
    );
    function rosterForSeat(seat: LineupSeat) {
      const availableForThisSeat = eligibleRoster.filter(
        (p) => p.id === seat.rower_id || !assignedInThisBoatIds.has(p.id)
      );
      return seat.rower_id && !availableForThisSeat.some((p) => p.id === seat.rower_id)
        ? [
            ...availableForThisSeat,
            { id: seat.rower_id, display_name: nameById.get(seat.rower_id) ?? "Unknown" },
          ]
        : availableForThisSeat;
    }
    return (
      <div className="border rounded-lg p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">
              {lineup.boat_name}{" "}
              <span className="text-sm text-gray-500">
                ({BOAT_CLASSES[lineup.boat_class]?.label ?? lineup.boat_class})
              </span>
            </p>
            {lineup.notes && <p className="text-sm text-gray-500">{lineup.notes}</p>}
            <EditRaceInfo lineup={lineup} canManage={canManage} />
            <EditRaceResult lineup={lineup} canManage={canManage} />
          </div>
          {canManage && <DeleteLineupButton lineupId={lineup.id} />}
        </div>

        <ul className="mt-2 flex flex-col gap-1.5">
          {lineupSeats.map((seat) => (
            <li key={seat.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-500">
                {seat.seat_role === "rower"
                  ? `${SEAT_ROLE_LABEL[seat.seat_role]} ${seat.seat_number}`
                  : SEAT_ROLE_LABEL[seat.seat_role]}
              </span>
              {canManage ? (
                <SeatAssign
                  seatId={seat.id}
                  currentRowerId={seat.rower_id}
                  roster={rosterForSeat(seat)}
                />
              ) : (
                <span>{seat.rower_id ? nameById.get(seat.rower_id) ?? "Unknown" : "—"}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function EventSection({ event }: { event: ScheduleEvent }) {
    const eventLineups = lineups.filter((l) => l.event_id === event.id);
    const uncategorized = eventLineups.filter((l) => !l.category);
    const eventPendingRaces = pendingRaces.filter((r) => r.event_id === event.id);

    const starredNames = parseStarredLines(event.description);
    const eventRaceNames = new Set(races.filter((r) => r.event_id === event.id).map((r) => r.race_name));
    const newStarredCount = starredNames.filter((name) => !eventRaceNames.has(name)).length;

    return (
      <div>
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          <EventIcon title={event.title} className="w-6 h-6" />
          {event.title}{" "}
          <span className="text-sm font-normal text-gray-500">
            {new Date(event.starts_at).toLocaleDateString()}
          </span>
        </h2>

        <div className="mt-3 flex flex-col gap-5 max-w-lg">
          {canManage && newStarredCount > 0 && (
            <ImportStarredRacesButton eventId={event.id} count={newStarredCount} />
          )}

          {(eventPendingRaces.length > 0 || canManage) && (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-primary)] mb-2">
                Races needing a lineup {eventPendingRaces.length > 0 && `(${eventPendingRaces.length})`}
              </h3>
              {eventPendingRaces.length > 0 && (
                <div className="flex flex-col gap-3 mb-3">
                  {eventPendingRaces.map((race) => (
                    <PendingRaceRow
                      key={race.id}
                      race={race}
                      boats={boats}
                      canManage={canManage}
                    />
                  ))}
                </div>
              )}
              {canManage && <ImportRacesForm eventId={event.id} />}
            </div>
          )}

          {LINEUP_CATEGORY_OPTIONS.map((cat) => {
            const categoryLineups = eventLineups.filter((l) => l.category === cat);
            if (categoryLineups.length === 0) return null;
            if (!sectionVisible(LINEUP_CATEGORY_TEAM[cat])) return null;
            return (
              <div key={cat}>
                <h3 className="text-sm font-medium text-[var(--color-primary)] mb-2">{LINEUP_CATEGORIES[cat]}</h3>
                <div className="flex flex-col gap-3">
                  {categoryLineups.map((lineup) => (
                    <LineupCard key={lineup.id} lineup={lineup} />
                  ))}
                </div>
              </div>
            );
          })}

          {uncategorized.length > 0 && (
            <div className="flex flex-col gap-3">
              {uncategorized.map((lineup) => (
                <LineupCard key={lineup.id} lineup={lineup} />
              ))}
            </div>
          )}

          {canManage && <CreateLineupForm eventId={event.id} boats={boats} />}
          {!canManage && eventLineups.length === 0 && (
            <p className="text-sm text-gray-500">No lineups posted yet.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Lineups</h1>

      {canManage && sectionVisible("fleet") && <BoatsSection boats={boats} />}
      {canManage && sectionVisible("templates") && (
        <LineupTemplatesSection
          templates={templates}
          templateSeats={templateSeats}
          roster={roster}
          boats={boats}
        />
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-sm text-gray-500">No events on the schedule yet.</p>
      )}

      <div className="flex flex-col gap-8">
        {upcoming.map((event) => (
          <EventSection key={event.id} event={event} />
        ))}
      </div>

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-black">
            Past ({past.length})
          </summary>
          <div className="mt-3 flex flex-col gap-8">
            {past.map((event) => (
              <EventSection key={event.id} event={event} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
