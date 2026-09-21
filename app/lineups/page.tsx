import { createClient } from "@/lib/supabase/server";
import type { Lineup, LineupSeat, Profile, ScheduleEvent } from "@/lib/database.types";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { LINEUP_CATEGORIES, LINEUP_CATEGORY_OPTIONS } from "@/lib/lineupCategories";
import { CreateLineupForm } from "./CreateLineupForm";
import { SeatAssign } from "./SeatAssign";
import { DeleteLineupButton } from "./DeleteLineupButton";

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

  const { data: seatsData } = await supabase
    .from("lineup_seats")
    .select("*")
    .order("seat_number", { ascending: true });
  const seats = (seatsData as LineupSeat[] | null) ?? [];

  const { data: rosterData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .is("disabled_at", null)
    .order("display_name", { ascending: true });
  const roster = (rosterData as Pick<Profile, "id" | "display_name">[] | null) ?? [];
  const nameById = new Map(roster.map((p) => [p.id, p.display_name]));

  const eventIdsWithLineups = new Set(lineups.map((l) => l.event_id));
  const now = new Date();
  const relevantEvents = events.filter(
    (e) => new Date(e.starts_at).getTime() >= now.getTime() || eventIdsWithLineups.has(e.id)
  );
  const upcoming = relevantEvents.filter((e) => new Date(e.starts_at).getTime() >= now.getTime());
  const past = relevantEvents
    .filter((e) => new Date(e.starts_at).getTime() < now.getTime())
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  function EventSection({ event }: { event: ScheduleEvent }) {
    const eventLineups = lineups.filter((l) => l.event_id === event.id);
    return (
      <div>
        <h2 className="text-lg font-semibold">
          {event.title}{" "}
          <span className="text-sm font-normal text-gray-500">
            {new Date(event.starts_at).toLocaleDateString()}
          </span>
        </h2>

        <div className="mt-3 flex flex-col gap-3 max-w-lg">
          {eventLineups.map((lineup) => {
            const lineupSeats = seats.filter((s) => s.lineup_id === lineup.id);
            return (
              <div key={lineup.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">
                      {lineup.boat_name}{" "}
                      <span className="text-sm text-gray-500">
                        ({BOAT_CLASSES[lineup.boat_class]?.label ?? lineup.boat_class})
                      </span>
                    </p>
                    {lineup.notes && <p className="text-sm text-gray-500">{lineup.notes}</p>}
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
                          roster={roster}
                        />
                      ) : (
                        <span>
                          {seat.rower_id ? nameById.get(seat.rower_id) ?? "Unknown" : "—"}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {canManage && <CreateLineupForm eventId={event.id} />}
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
