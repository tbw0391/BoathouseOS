import type { Lineup, LineupSeat, LineupCategory } from "@/lib/database.types";

export type RaceBoxState = "pending" | "assigned" | "gold" | "silver" | "bronze";

// One grid box per race (or per boat, for a lineup that was never built from
// an imported/starred race row). `key` stays stable across the
// pending -> assigned transition when it came from a race, so the detail
// panel below the grid doesn't lose its selection the moment a boat is
// assigned.
export interface RaceBoxItem {
  key: string;
  label: string;
  categoryLabel: string;
  category: LineupCategory | null;
  state: RaceBoxState;
  raceId: string | null;
  lineup: Lineup | null;
  lineupSeats: LineupSeat[];
  // The boat's oar set from its oar sheet ("1 Green"), if picked.
  oars: { tape_color: string; rings: number } | null;
  eligibleRoster: { id: string; display_name: string }[];
}
