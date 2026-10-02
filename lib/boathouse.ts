// Boathouse (0128): rower ratings, boat and erg reservations, and the boat
// sign-out logbook.

export const RATING_LEVELS = [
  { level: 0, label: "Not rated", detail: "Coached rows only, or boats open to everyone." },
  { level: 1, label: "Level 1", detail: "Stable club boats." },
  { level: 2, label: "Level 2", detail: "Most club boats." },
  { level: 3, label: "Level 3", detail: "Racing singles and the club's fastest boats." },
] as const;

export const ratingLabel = (level: number | null | undefined) =>
  RATING_LEVELS.find((r) => r.level === (level ?? 0))?.label ?? "Not rated";

export type BoathouseBoat = {
  id: string;
  name: string;
  boat_class: string;
  bookable: boolean;
  min_rating: number;
  out_of_service: boolean;
};

export type Erg = {
  id: string;
  name: string;
  bookable: boolean;
  out_of_service: boolean;
  notes: string | null;
};

export type Reservation = {
  id: string;
  boat_id: string | null;
  erg_id: string | null;
  booked_by: string | null;
  rower_ids: string[];
  starts_at: string;
  ends_at: string;
  note: string | null;
};

export type SignOut = {
  id: string;
  boat_id: string;
  rower_ids: string[];
  signed_out_by: string | null;
  out_at: string;
  expected_back_at: string;
  route: string | null;
  back_at: string | null;
  meters: number | null;
  damage: string | null;
};

// Booking lengths offered, in minutes.
export const BOOKING_LENGTHS = [30, 45, 60, 75, 90, 120, 150, 180];

export function isOverdue(s: Pick<SignOut, "back_at" | "expected_back_at">, now: Date = new Date()): boolean {
  return !s.back_at && new Date(s.expected_back_at).getTime() < now.getTime();
}

// Friendly text for the database's refusals (they're written for people).
export function boathouseError(message: string): string | null {
  return /^(Not signed in|Pick |The end time|Bookings can|That time|You can book|That boat|That one|Only |Someone |Who's|It's already|Distance)/.test(
    message
  ) || / (needs a level|swim test isn't|is out of service|is booked by|is already out)/.test(message)
    ? message
    : null;
}
