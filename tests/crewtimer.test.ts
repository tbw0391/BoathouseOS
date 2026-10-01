import { describe, expect, it } from "vitest";
import { clubRaces, crewNamesIn, crewTimerFeedUrl, crewTimerStartLocal, type Feed } from "@/lib/crewtimer";
import { hotcRaceCategory, hotcRaceName } from "@/lib/hotc";
import { categoryForRace } from "@/lib/lineupCategories";

describe("crewTimerFeedUrl", () => {
  it("finds the regatta id in a pasted link", () => {
    const feed = "https://crewtimer-results.firebaseio.com/results/r16268.json";
    expect(crewTimerFeedUrl("https://www.crewtimer.com/regatta/r16268")).toBe(feed);
    expect(crewTimerFeedUrl("crewtimer.com/regatta/r16268?tab=1")).toBe(feed);
    expect(crewTimerFeedUrl("R16268")).toBe(feed);
  });
  it("only ever points at CrewTimer's feed host", () => {
    expect(crewTimerFeedUrl("https://evil.example/r1234/x")).toBe(
      "https://crewtimer-results.firebaseio.com/results/r1234.json"
    );
    expect(crewTimerFeedUrl("hello")).toBeNull();
  });
});

const feed: Feed = {
  regattaInfo: { Date: "2026-09-26", Title: "Test Head" },
  results: [
    {
      EventNum: "10",
      Event: "10 Mens Youth 8+",
      Start: "8:45 AM",
      entries: [
        { Bow: "3", Crew: "St. Ignatius A" },
        { Bow: "4", Crew: "St. Ignatius B" },
        { Bow: "5", Crew: "Other Club" },
      ],
    },
    { EventNum: "11", Event: "11 Womens Masters 4+", Start: "9:00 AM", entries: [{ Bow: "1", Crew: "st ignatius" }] },
  ],
};

describe("clubRaces", () => {
  it("matches a club ignoring case, punctuation and boat letters", () => {
    const races = clubRaces(feed, ["St. Ignatius"]);
    expect(races.map((r) => [r.eventNum, r.bow])).toEqual([
      ["10", "3"],
      ["10", "4"],
      ["11", "1"],
    ]);
    expect(races[0].eventName).toBe("Mens Youth 8+");
    expect(hotcRaceName(races[1])).toBe("Race 10: Mens Youth 8+ (Bow 4)");
  });
  it("lists every club once, however it's spelled", () => {
    expect(crewNamesIn(feed)).toEqual(["Other Club", "St. Ignatius"]);
  });
});

describe("race categories", () => {
  it("guesses squad, depth and boat from the event and boat letter", () => {
    expect(hotcRaceCategory({ eventName: "Womens Youth 2nd 8+", crew: "X" })).toBe("womens_2_8plus");
    expect(hotcRaceCategory({ eventName: "Mens Youth U19 2nd8+", crew: "X" })).toBe("mens_2_8plus");
    expect(hotcRaceCategory({ eventName: "Womens Youth U19 1st8+", crew: "X B" })).toBe("womens_1_8plus");
    expect(hotcRaceCategory({ eventName: "Mens Youth 8+", crew: "Club B" })).toBe("mens_2_8plus");
    expect(hotcRaceCategory({ eventName: "Womens Masters 4+", crew: "Club" })).toBe("masters_1_4plus");
    expect(hotcRaceCategory({ eventName: "Mixed 8+", crew: "Club" })).toBeNull();
    expect(hotcRaceCategory({ eventName: "Mens Open 1x", crew: "Club" })).toBeNull();
  });
  it("treats a masters race as masters whatever boat rows it", () => {
    expect(categoryForRace("Race 12: Men's Masters 8+", "mens_1_8plus")).toBe("masters");
    expect(categoryForRace("Race 12: Men's Masters 8+", "masters_2_8plus")).toBe("masters_2_8plus");
    expect(categoryForRace("Race 3: Mens Youth 8+", "mens_1_8plus")).toBe("mens_1_8plus");
  });
});

describe("crewTimerStartLocal", () => {
  it("reads a clock time on the regatta's date", () => {
    expect(crewTimerStartLocal("2026-09-26", "8:45 AM")).toEqual({ date: "2026-09-26", hour: 8, minute: 45 });
    expect(crewTimerStartLocal("2026-09-26", "12:05 PM")).toEqual({ date: "2026-09-26", hour: 12, minute: 5 });
    expect(crewTimerStartLocal("2026-09-26", "12:05 AM")).toEqual({ date: "2026-09-26", hour: 0, minute: 5 });
  });
  it("reads a month/day and 24-hour time at multi-day regattas", () => {
    expect(crewTimerStartLocal("2026-10-03", "10/3 8:00")).toEqual({ date: "2026-10-03", hour: 8, minute: 0 });
    expect(crewTimerStartLocal("2026-10-03", "10/4 13:25")).toEqual({ date: "2026-10-04", hour: 13, minute: 25 });
  });
  it("gives up on anything else", () => {
    expect(crewTimerStartLocal("2026-10-03", "8:00")).toBeNull();
    expect(crewTimerStartLocal("2026-10-03", "")).toBeNull();
    expect(crewTimerStartLocal("2026-10-03", null)).toBeNull();
  });
});
