export interface BoatClassSpec {
  label: string;
  rowerSeats: number;
  hasCoxswain: boolean;
}

export const BOAT_CLASSES: Record<string, BoatClassSpec> = {
  "1x": { label: "1x (Single)", rowerSeats: 1, hasCoxswain: false },
  "2x": { label: "2x (Double)", rowerSeats: 2, hasCoxswain: false },
  "2-": { label: "2- (Pair)", rowerSeats: 2, hasCoxswain: false },
  "4+": { label: "4+ (Four w/ cox)", rowerSeats: 4, hasCoxswain: true },
  "4x": { label: "4x (Quad)", rowerSeats: 4, hasCoxswain: false },
  "4-": { label: "4- (Straight four)", rowerSeats: 4, hasCoxswain: false },
  "8+": { label: "8+ (Eight)", rowerSeats: 8, hasCoxswain: true },
};

export const BOAT_CLASS_OPTIONS = Object.keys(BOAT_CLASSES);
