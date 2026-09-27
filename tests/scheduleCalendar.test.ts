import { describe, expect, it } from "vitest";
import { calendarItemsByDay, type CalendarEvent } from "@/lib/scheduleCalendar";

const ev = (id: string, event_type: CalendarEvent["event_type"], starts_at: string, recurrence: CalendarEvent["recurrence"]): CalendarEvent => ({
  id,
  title: id,
  event_type,
  starts_at,
  ends_at: null,
  recurrence,
  location: null,
});

const october = (events: CalendarEvent[]) => calendarItemsByDay(events, new Date(2026, 9, 1), new Date(2026, 10, 1));
const titles = (m: Map<string, { title: string }[]>, day: string) => (m.get(day) ?? []).map((i) => i.title);

describe("calendarItemsByDay", () => {
  it("repeats weekly events every week", () => {
    const m = october([ev("meeting", "meeting", "2026-09-02T19:00:00", "weekly")]);
    const days = [...m.entries()].filter(([, items]) => items.some((i) => i.title === "meeting")).map(([d]) => d);
    expect(days).toEqual(["2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"]);
  });

  it("skips months without the day for a monthly event on the 31st", () => {
    const m = october([ev("monthly", "other", "2026-08-31T12:00:00", "monthly")]);
    expect(titles(m, "2026-10-31")).toContain("monthly");
    expect(titles(m, "2026-10-01")).not.toContain("monthly");
  });

  it("shows standing practice times on weekdays and Saturdays, not Sundays", () => {
    const m = october([]);
    expect(titles(m, "2026-10-05")).toEqual(["Practice"]); // Monday
    expect(m.get("2026-10-05")![0].start.getHours()).toBe(16);
    expect(m.get("2026-10-03")![0].start.getHours()).toBe(8); // Saturday
    expect(m.get("2026-10-04")).toBeUndefined(); // Sunday
  });

  it("hides the standing practice on days with a practice or regatta scheduled", () => {
    const m = october([
      ev("regatta", "regatta", "2026-10-10T08:00:00", "none"),
      ev("early practice", "practice", "2026-10-03T07:00:00", "none"),
    ]);
    expect(titles(m, "2026-10-10")).toEqual(["regatta"]);
    expect(titles(m, "2026-10-03")).toEqual(["early practice"]);
  });
});
