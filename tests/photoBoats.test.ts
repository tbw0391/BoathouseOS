import { describe, expect, it } from "vitest";
import { boatsByDay, dayLabel } from "@/lib/photoBoats";

const boat = (lineupId: string, dateKey: string, label: string, memberIds: string[]) => ({
  lineupId,
  dateKey,
  eventTitle: "Regatta",
  label,
  memberIds,
});

describe("boatsByDay", () => {
  it("groups by day, newest first, and skips empty boats", () => {
    const days = boatsByDay([
      boat("a", "2026-09-26", "Varsity 8", ["1", "2"]),
      boat("b", "2026-09-28", "JV 4", ["3"]),
      boat("c", "2026-09-28", "Empty", []),
      boat("d", "2026-09-28", "Frosh 8", ["4"]),
    ]);
    expect(days.map((d) => d.dateKey)).toEqual(["2026-09-28", "2026-09-26"]);
    expect(days[0].boats.map((b) => b.label)).toEqual(["Frosh 8", "JV 4"]);
  });
});

describe("dayLabel", () => {
  it("says Today and Yesterday, otherwise the date", () => {
    expect(dayLabel("2026-09-28", "2026-09-28")).toBe("Today");
    expect(dayLabel("2026-09-27", "2026-09-28")).toBe("Yesterday");
    expect(dayLabel("2026-09-26", "2026-09-28")).toBe("Sat, Sep 26");
  });
});
