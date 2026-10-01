import type { FoodTentMessage } from "@/lib/database.types";

const DAY = 24 * 60 * 60 * 1000;

// A food tent banner message (0118) shows for a week, or, when it's about a
// regatta, until the day after that regatta ends.
export function foodMessageIsActive(
  m: Pick<FoodTentMessage, "event_id" | "created_at">,
  regatta: { starts_at: string; ends_at: string | null } | undefined,
  now = new Date()
): boolean {
  if (m.event_id) {
    if (!regatta) return false;
    return new Date(regatta.ends_at ?? regatta.starts_at).getTime() + DAY > now.getTime();
  }
  return new Date(m.created_at).getTime() + 7 * DAY > now.getTime();
}
