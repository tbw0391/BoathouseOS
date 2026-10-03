import Link from "next/link";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { oarLabel, tapeSwatch } from "@/lib/oarSheet";
import { SeatFiller } from "./SeatFiller";
import { assignSeat } from "./actions";
import { DeleteLineupButton } from "./DeleteLineupButton";
import { EditRaceInfo } from "./EditRaceInfo";
import { EditLineupDetails } from "./EditLineupDetails";
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
  oars = null,
  eligibleRoster,
  canManage,
}: {
  lineup: Lineup;
  lineupSeats: LineupSeat[];
  oars?: { tape_color: string; rings: number; swatch?: string } | null;
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
          <EditLineupDetails lineup={lineup} canManage={canManage} />
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

      {lineup.event_id && lineup.boat_id && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {oars ? (
            <span className="flex items-center gap-1.5 font-medium">
              <span
                className="inline-block w-4 h-4 rounded-full border border-gray-400"
                style={{ backgroundColor: oars.swatch ?? tapeSwatch(oars.tape_color) }}
                aria-hidden
              />
              Oars: {oarLabel(oars)}
            </span>
          ) : (
            <span className="text-amber-700">Oars not picked</span>
          )}
          <Link href={`/oar-sheet/${lineup.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
            Oar sheet →
          </Link>
        </div>
      )}
    </div>
  );
}
