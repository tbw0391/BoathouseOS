import { describe, expect, it } from "vitest";
import { buildCalendar, clubDateTime, clubLocalStamp, escapeIcalText } from "@/lib/ical";

describe("club time", () => {
  it("writes times as club wall-clock time", () => {
    expect(clubLocalStamp(new Date("2026-10-03T13:40:00Z"))).toBe("20261003T094000");
    expect(clubLocalStamp(new Date("2026-12-03T14:40:00Z"))).toBe("20261203T094000");
  });

  it("finds the moment for a club date and time, either side of daylight saving", () => {
    expect(clubDateTime("2026-10-03", "16:15").toISOString()).toBe("2026-10-03T20:15:00.000Z");
    expect(clubDateTime("2026-12-03", "16:15").toISOString()).toBe("2026-12-03T21:15:00.000Z");
  });
});

describe("buildCalendar", () => {
  it("builds a feed with repeats, skipped days and escaped text", () => {
    const ics = buildCalendar(
      "Club",
      [
        {
          uid: "p@x",
          title: "Practice",
          start: clubDateTime("2026-10-05", "16:15"),
          end: clubDateTime("2026-10-05", "18:30"),
          rrule: "FREQ=WEEKLY;BYDAY=MO",
          exdates: [clubDateTime("2026-10-12", "16:15")],
          location: "Boathouse, Dock 2",
        },
      ],
      new Date("2026-09-28T00:00:00Z")
    );
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART;TZID=America/New_York:20261005T161500");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(ics).toContain("EXDATE;TZID=America/New_York:20261012T161500");
    expect(ics).toContain("LOCATION:Boathouse\\, Dock 2");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });

  it("escapes commas, semicolons and new lines", () => {
    expect(escapeIcalText("a,b;c\nd")).toBe("a\\,b\\;c\\nd");
  });
});
