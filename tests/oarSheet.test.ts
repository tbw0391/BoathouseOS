import { describe, expect, it } from "vitest";
import { boatOarSet, captainSeat, oarLabel, oarSeats, oarSheetComplete, parseOarSettings, DEFAULT_OAR_SETTINGS } from "@/lib/oarSheet";

const seat = (seat_number: number, seat_role: string, rower_id: string | null = null) => ({ seat_number, seat_role, rower_id });

describe("captainSeat", () => {
  it("is the cox when the boat has one", () => {
    const seats = [seat(1, "rower", "a"), seat(4, "rower", "d"), seat(5, "coxswain", "c")];
    expect(captainSeat(seats)?.rower_id).toBe("c");
  });

  it("is stroke (highest rower seat) with no cox", () => {
    const seats = [seat(2, "rower", "b"), seat(1, "rower", "a")];
    expect(captainSeat(seats)?.rower_id).toBe("b");
  });

  it("ignores a coach seat", () => {
    expect(captainSeat([seat(1, "rower", "a"), seat(9, "coach", "z")])?.rower_id).toBe("a");
  });
});

describe("oarSheetComplete", () => {
  const seats = [seat(1, "rower"), seat(2, "rower"), seat(3, "coxswain")];

  it("needs an oar in every rowing seat and someone on each task", () => {
    expect(oarSheetComplete(seats, [{ seat_number: 1 }, { seat_number: 2 }], [{ assigned: 1 }, { assigned: 1 }])).toBe(true);
    expect(oarSheetComplete(seats, [{ seat_number: 1 }], [{ assigned: 1 }, { assigned: 1 }])).toBe(false);
    expect(oarSheetComplete(seats, [{ seat_number: 1 }, { seat_number: 2 }], [{ assigned: 1 }, { assigned: 0 }])).toBe(false);
  });

  it("orders rowing seats bow to stroke, without the cox", () => {
    expect(oarSeats([seat(3, "coxswain"), seat(2, "rower"), seat(1, "rower")]).map((s) => s.seat_number)).toEqual([1, 2]);
  });
});

describe("parseOarSettings", () => {
  it("falls back to defaults", () => {
    expect(parseOarSettings(null)).toEqual(DEFAULT_OAR_SETTINGS);
    expect(parseOarSettings("not json")).toEqual(DEFAULT_OAR_SETTINGS);
    expect(parseOarSettings(JSON.stringify({ colors: [], maxRings: 99 }))).toEqual(DEFAULT_OAR_SETTINGS);
  });

  it("reads saved colors and rings", () => {
    expect(parseOarSettings(JSON.stringify({ colors: ["Blue", " Green "], maxRings: 4 }))).toEqual({
      colors: ["Blue", "Green"],
      maxRings: 4,
    });
  });
});

it("names an oar by rings and color", () => {
  expect(oarLabel({ rings: 3, tape_color: "Green" })).toBe("3 Green");
});

describe("boatOarSet", () => {
  it("is the set every seat shares", () => {
    const g = { tape_color: "Green", rings: 1 };
    expect(boatOarSet([g, { ...g }])).toEqual(g);
    expect(boatOarSet([g, { tape_color: "Green", rings: 2 }])).toBeNull();
    expect(boatOarSet([])).toBeNull();
  });
});
