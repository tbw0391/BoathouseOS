import { BOAT_CLASSES } from "@/lib/boatClasses";
import { SeatAssign } from "./SeatAssign";
import { DeleteLineupButton } from "./DeleteLineupButton";
import { EditRaceInfo } from "./EditRaceInfo";
import { EditRaceResult } from "./EditRaceResult";
import type { Lineup, LineupSeat } from "@/lib/database.types";

const SEAT_ROLE_LABEL: Record<LineupSeat["seat_role"], string> = {
  rower: "Seat",
  coxswain: "Coxswain",
  coach: "Coach",
};

export function LineupDetail({
  lineup,
  lineupSeats,
  eligibleRoster,
  canManage,
}: {
  lineup: Lineup;
  lineupSeats: LineupSeat[];
  eligibleRoster: { id: string; display_name: string }[];
  canManage: boolean;
}) {
  const nameById = new Map(eligibleRoster.map((p) => [p.id, p.display_name]));

  // Once someone's picked for one seat in this boat, they drop out of every
  // other seat's dropdown in the same boat — a boat's own list shrinks as
  // it fills in, but stays full for every other boat.
  const assignedInThisBoatIds = new Set(
    lineupSeats.map((s) => s.rower_id).filter((id): id is string => !!id)
  );
  function rosterForSeat(seat: LineupSeat) {
    const availableForThisSeat = eligibleRoster.filter(
      (p) => p.id === seat.rower_id || !assignedInThisBoatIds.has(p.id)
    );
    return seat.rower_id && !availableForThisSeat.some((p) => p.id === seat.rower_id)
      ? [...availableForThisSeat, { id: seat.rower_id, display_name: "Unknown" }]
      : availableForThisSeat;
  }

  return (
    <div className="border rounded-lg p-4">
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

      <ul className="mt-3 flex flex-col gap-1.5">
        {lineupSeats.map((seat) => (
          <li key={seat.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-gray-500">
              {seat.seat_role === "rower"
                ? `${SEAT_ROLE_LABEL[seat.seat_role]} ${seat.seat_number}`
                : SEAT_ROLE_LABEL[seat.seat_role]}
            </span>
            {canManage ? (
              <SeatAssign seatId={seat.id} currentRowerId={seat.rower_id} roster={rosterForSeat(seat)} />
            ) : (
              <span>{seat.rower_id ? nameById.get(seat.rower_id) ?? "Unknown" : "—"}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
