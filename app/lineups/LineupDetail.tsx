import { BOAT_CLASSES } from "@/lib/boatClasses";
import { SeatFiller } from "./SeatFiller";
import { assignSeat } from "./actions";
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

      <div className="mt-3">
        {canManage ? (
          <SeatFiller seats={lineupSeats} roster={eligibleRoster} onAssign={assignSeat} />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {lineupSeats.map((seat) => (
              <li key={seat.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-500">
                  {seat.seat_role === "rower"
                    ? `${SEAT_ROLE_LABEL[seat.seat_role]} ${seat.seat_number}`
                    : SEAT_ROLE_LABEL[seat.seat_role]}
                </span>
                <span>{seat.rower_id ? nameById.get(seat.rower_id) ?? "Unknown" : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
