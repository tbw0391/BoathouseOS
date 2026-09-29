// Race Day page (/race-day): which regatta it's about, and when each crew
// needs to be on the water.

export const LAUNCH_MINUTES_KEY = "race_day_launch_minutes";
export const DEFAULT_LAUNCH_MINUTES = 45;
export const LAUNCH_MINUTE_OPTIONS = [30, 45, 60, 75, 90];

export const CLUB_TIME_ZONE = "America/New_York";

export function parseLaunchMinutes(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 240 ? n : DEFAULT_LAUNCH_MINUTES;
}

// Tap choices for "running late" on the Race Day page.
export const DELAY_MINUTE_OPTIONS = [0, 10, 15, 20, 30, 45, 60, 90];

// Minutes before the (delayed) race time a coach's "racing soon" alert means.
export const RACE_SOON_MINUTES = 20;

// When a race will actually go: its scheduled time plus how late the regatta
// is running.
export function delayedRaceTime(raceTimeIso: string, delayMinutes: number = 0): string {
  return new Date(new Date(raceTimeIso).getTime() + delayMinutes * 60 * 1000).toISOString();
}

export function launchTime(raceTimeIso: string, launchMinutes: number): Date {
  return new Date(new Date(raceTimeIso).getTime() - launchMinutes * 60 * 1000);
}

export function clubTimeLabel(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-US", { timeZone: CLUB_TIME_ZONE, hour: "numeric", minute: "2-digit" });
}

export function clubDateKey(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: CLUB_TIME_ZONE });
}

type EventLike = { id: string; starts_at: string; ends_at: string | null };

// The regatta happening today (club time), or else the next one coming up.
// `events` should already be regattas from yesterday onward, soonest first.
export function pickRaceDayEvent<E extends EventLike>(events: E[], now: Date = new Date()): E | null {
  const today = clubDateKey(now);
  const onToday = events.find((e) => {
    const first = clubDateKey(e.starts_at);
    const last = clubDateKey(e.ends_at ?? e.starts_at);
    return first <= today && today <= last;
  });
  if (onToday) return onToday;
  return events.find((e) => clubDateKey(e.starts_at) > today) ?? null;
}

// Done once a place is in, or 2 hours after the start (plus any delay the
// coach has set; regattas run late).
export function raceIsOver(
  race: { place: number | null; race_time: string | null },
  now: Date = new Date(),
  delayMinutes: number = 0
): boolean {
  if (race.place != null) return true;
  return (
    race.race_time != null &&
    new Date(delayedRaceTime(race.race_time, delayMinutes)).getTime() + 2 * 60 * 60 * 1000 < now.getTime()
  );
}

// A regatta is finished (moves below the upcoming ones) once every one of
// our boats there has a result, or once its last day is over, club time.
export function regattaIsFinished(
  event: { starts_at: string; ends_at: string | null },
  lineups: { place: number | null }[],
  now: Date = new Date()
): boolean {
  if (clubDateKey(event.ends_at ?? event.starts_at) < clubDateKey(now)) return true;
  return lineups.length > 0 && lineups.every((l) => l.place != null);
}

export function seatLabel(seat: { seat_number: number; seat_role: string }, rowerSeats: number): string {
  if (seat.seat_role === "coxswain") return "Cox";
  if (seat.seat_role === "coach") return "Coach";
  if (rowerSeats > 1 && seat.seat_number === 1) return "Bow";
  if (rowerSeats > 1 && seat.seat_number === rowerSeats) return "Stroke";
  return `${seat.seat_number}`;
}

// "Race 39: Mens Rec 4+ (Bow 265)" -> "265" (CrewTimer imports put the bow
// number in the race name).
export function bowFromRaceName(raceName: string | null | undefined): string | null {
  return raceName?.match(/\(Bow\s+([A-Za-z0-9-]{1,10})\)\s*$/i)?.[1] ?? null;
}
