import { describe, expect, it } from "vitest";
import {
  clubTimeLabel,
  launchTime,
  parseLaunchMinutes,
  pickRaceDayEvent,
  raceIsOver,
  regattaIsFinished,
  delayedRaceTime,
  seatLabel,
  bowFromRaceName,
} from "@/lib/raceDay";

describe("launch time", () => {
  it("is the race time minus the club's minutes, shown in club time", () => {
    const launch = launchTime("2026-10-03T14:40:00Z", 45);
    expect(launch.toISOString()).toBe("2026-10-03T13:55:00.000Z");
    expect(clubTimeLabel(launch)).toBe("9:55 AM");
  });

  it("falls back to 45 minutes for a missing or silly setting", () => {
    expect(parseLaunchMinutes(null)).toBe(45);
    expect(parseLaunchMinutes("abc")).toBe(45);
    expect(parseLaunchMinutes("0")).toBe(45);
    expect(parseLaunchMinutes("60")).toBe(60);
  });
});

describe("pickRaceDayEvent", () => {
  const events = [
    { id: "cuyahoga", starts_at: "2026-09-26T12:00:00Z", ends_at: null },
    { id: "ohio", starts_at: "2026-10-03T12:00:00Z", ends_at: "2026-10-04T20:00:00Z" },
    { id: "later", starts_at: "2026-10-17T12:00:00Z", ends_at: null },
  ];

  it("picks the regatta on today, including the second day of a two-day one", () => {
    expect(pickRaceDayEvent(events, new Date("2026-10-03T15:00:00Z"))?.id).toBe("ohio");
    expect(pickRaceDayEvent(events, new Date("2026-10-04T15:00:00Z"))?.id).toBe("ohio");
  });

  it("otherwise picks the next one coming up", () => {
    expect(pickRaceDayEvent(events, new Date("2026-09-28T15:00:00Z"))?.id).toBe("ohio");
    expect(pickRaceDayEvent(events, new Date("2026-10-05T15:00:00Z"))?.id).toBe("later");
    expect(pickRaceDayEvent(events, new Date("2026-11-01T15:00:00Z"))).toBeNull();
  });

  it("uses club time, not UTC, for what counts as today", () => {
    // 11pm Eastern on Oct 2 is already Oct 3 in UTC.
    expect(pickRaceDayEvent(events, new Date("2026-10-03T03:00:00Z"))?.id).toBe("ohio");
    expect(pickRaceDayEvent([events[1]], new Date("2026-10-05T03:30:00Z"))?.id).toBe("ohio");
  });
});

describe("raceIsOver", () => {
  const now = new Date("2026-10-03T16:00:00Z");
  it("is over with a place, or two hours past the start", () => {
    expect(raceIsOver({ place: 3, race_time: null }, now)).toBe(true);
    expect(raceIsOver({ place: null, race_time: "2026-10-03T13:30:00Z" }, now)).toBe(true);
    expect(raceIsOver({ place: null, race_time: "2026-10-03T14:30:00Z" }, now)).toBe(false);
    expect(raceIsOver({ place: null, race_time: null }, now)).toBe(false);
  });
});

describe("seatLabel", () => {
  it("names bow, stroke and cox", () => {
    expect(seatLabel({ seat_number: 1, seat_role: "rower" }, 8)).toBe("Bow");
    expect(seatLabel({ seat_number: 4, seat_role: "rower" }, 8)).toBe("4");
    expect(seatLabel({ seat_number: 8, seat_role: "rower" }, 8)).toBe("Stroke");
    expect(seatLabel({ seat_number: 9, seat_role: "coxswain" }, 8)).toBe("Cox");
    expect(seatLabel({ seat_number: 1, seat_role: "rower" }, 1)).toBe("1");
  });
});

describe("bowFromRaceName", () => {
  it("reads the bow number CrewTimer imports add", () => {
    expect(bowFromRaceName("Race 39: Mens Rec 4+ (1500) (Bow 265)")).toBe("265");
    expect(bowFromRaceName("Men's 8+ Grand Final")).toBeNull();
    expect(bowFromRaceName(null)).toBeNull();
  });
});

describe("running late", () => {
  it("pushes the race back by the delay", () => {
    expect(delayedRaceTime("2026-10-03T14:40:00Z", 20)).toBe("2026-10-03T15:00:00.000Z");
    expect(delayedRaceTime("2026-10-03T14:40:00Z")).toBe("2026-10-03T14:40:00.000Z");
  });

  it("keeps a race open 2 hours past its delayed time", () => {
    const race = { place: null, race_time: "2026-10-03T14:00:00Z" };
    const now = new Date("2026-10-03T16:30:00Z");
    expect(raceIsOver(race, now)).toBe(true);
    expect(raceIsOver(race, now, 45)).toBe(false);
  });
});

describe("regattaIsFinished", () => {
  const regatta = { starts_at: "2026-10-03T12:00:00Z", ends_at: null };
  const raceDayMorning = new Date("2026-10-03T14:00:00Z");

  it("is finished once every boat has a result", () => {
    expect(regattaIsFinished(regatta, [{ place: 1 }, { place: 4 }], raceDayMorning)).toBe(true);
    expect(regattaIsFinished(regatta, [{ place: 1 }, { place: null }], raceDayMorning)).toBe(false);
  });

  it("isn't finished on the day with no boats yet", () => {
    expect(regattaIsFinished(regatta, [], raceDayMorning)).toBe(false);
  });

  it("is finished the day after, results or not (club time)", () => {
    // 11:30 PM Eastern on race day is still race day.
    expect(regattaIsFinished(regatta, [{ place: null }], new Date("2026-10-04T03:30:00Z"))).toBe(false);
    expect(regattaIsFinished(regatta, [{ place: null }], new Date("2026-10-04T05:00:00Z"))).toBe(true);
  });

  it("waits for the last day of a two-day regatta", () => {
    const twoDay = { starts_at: "2026-10-03T12:00:00Z", ends_at: "2026-10-04T20:00:00Z" };
    expect(regattaIsFinished(twoDay, [], new Date("2026-10-04T15:00:00Z"))).toBe(false);
    expect(regattaIsFinished(twoDay, [], new Date("2026-10-05T12:00:00Z"))).toBe(true);
  });
});

describe("club time on the server", () => {
  it("shows the club's date and time whatever zone the server runs in", async () => {
    const { clubDateLabel, clubTimeLabel } = await import("@/lib/raceDay");
    // 10:55 PM Eastern on Oct 3 is already Oct 4 in UTC.
    expect(clubDateLabel("2026-10-04T02:55:00Z")).toBe("10/3/2026");
    expect(clubTimeLabel("2026-10-04T14:55:00Z")).toBe("10:55 AM");
  });
});
