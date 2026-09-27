import type { EventType, ScheduleEvent } from "@/lib/database.types";

export type CalendarEvent = Pick<
  ScheduleEvent,
  "id" | "title" | "event_type" | "starts_at" | "ends_at" | "recurrence" | "location"
>;

// Regular practice times, shown on the calendar on any day that doesn't
// already have a practice or regatta on the schedule. day: 0 = Sunday ... 6 = Saturday.
export const STANDING_PRACTICES: { days: number[]; start: string; end: string }[] = [
  { days: [1, 2, 3, 4, 5], start: "16:15", end: "18:30" },
  { days: [6], start: "08:00", end: "10:00" },
];

export interface CalendarItem {
  key: string;
  eventId: string | null; // null for a standing practice
  title: string;
  eventType: EventType;
  start: Date;
  end: Date | null;
  location: string | null;
}

// YYYY-MM-DD in the viewer's local time.
export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addStep(d: Date, recurrence: CalendarEvent["recurrence"], n: number): Date {
  const next = new Date(d);
  if (recurrence === "weekly") next.setDate(d.getDate() + 7 * n);
  if (recurrence === "monthly") next.setMonth(d.getMonth() + n);
  if (recurrence === "yearly") next.setFullYear(d.getFullYear() + n);
  return next;
}

// Every occurrence of the events (recurring ones repeated) plus standing
// practices between from (inclusive) and to (exclusive), grouped by day.
export function calendarItemsByDay(events: CalendarEvent[], from: Date, to: Date) {
  const byDay = new Map<string, CalendarItem[]>();
  const add = (item: CalendarItem) => {
    const k = dayKey(item.start);
    byDay.set(k, [...(byDay.get(k) ?? []), item]);
  };

  for (const e of events) {
    const first = new Date(e.starts_at);
    const length = e.ends_at ? new Date(e.ends_at).getTime() - first.getTime() : null;
    const push = (start: Date) =>
      add({
        key: `${e.id}-${start.getTime()}`,
        eventId: e.id,
        title: e.title,
        eventType: e.event_type,
        start,
        end: length != null ? new Date(start.getTime() + length) : null,
        location: e.location,
      });

    if (e.recurrence === "none") {
      if (first >= from && first < to) push(first);
      continue;
    }
    for (let n = 0; n < 1000; n++) {
      const start = addStep(first, e.recurrence, n);
      if (start >= to) break;
      // Monthly on the 31st etc.: skip months that don't have that day
      // rather than letting the date roll into the next month.
      if (e.recurrence !== "weekly" && start.getDate() !== first.getDate()) continue;
      if (start >= from) push(start);
    }
  }

  for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d);
    if (byDay.get(k)?.some((i) => i.eventType === "practice" || i.eventType === "regatta")) continue;
    for (const p of STANDING_PRACTICES) {
      if (!p.days.includes(d.getDay())) continue;
      const at = (hhmm: string) => {
        const [h, m] = hhmm.split(":").map(Number);
        const t = new Date(d);
        t.setHours(h, m, 0, 0);
        return t;
      };
      add({
        key: `standing-${k}-${p.start}`,
        eventId: null,
        title: "Practice",
        eventType: "practice",
        start: at(p.start),
        end: at(p.end),
        location: null,
      });
    }
  }

  for (const items of byDay.values()) items.sort((a, b) => a.start.getTime() - b.start.getTime());
  return byDay;
}
