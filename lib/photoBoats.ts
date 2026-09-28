// Tagging a whole boat in a photo: the crews from recent lineups, grouped by
// day (newest first), each boat with the people seated in it that day.

export interface PhotoBoat {
  lineupId: string;
  dateKey: string;
  eventTitle: string;
  label: string;
  memberIds: string[];
}

export interface PhotoBoatDay {
  dateKey: string;
  boats: PhotoBoat[];
}

export function boatsByDay(boats: PhotoBoat[]): PhotoBoatDay[] {
  const byDay = new Map<string, PhotoBoat[]>();
  for (const b of boats) {
    if (b.memberIds.length === 0) continue;
    byDay.set(b.dateKey, [...(byDay.get(b.dateKey) ?? []), b]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, dayBoats]) => ({
      dateKey,
      boats: dayBoats.sort((a, b) => a.label.localeCompare(b.label)),
    }));
}

// "2026-09-28" -> "Today" / "Yesterday" / "Sat, Sep 26".
export function dayLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "Today";
  const day = new Date(`${dateKey}T12:00:00`);
  const today = new Date(`${todayKey}T12:00:00`);
  if (Math.round((today.getTime() - day.getTime()) / 86400000) === 1) return "Yesterday";
  return day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
