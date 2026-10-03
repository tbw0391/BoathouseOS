import { describe, expect, it } from "vitest";
import {
  boatOarSet,
  captainSeat,
  oarAllowed,
  oarLabel,
  oarSeats,
  oarSetsFor,
  oarSheetComplete,
  parseOarSettings,
  tapeSwatch,
  DEFAULT_OAR_SETTINGS,
} from "@/lib/oarSheet";

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

  it("reads the older plain-name colors", () => {
    expect(parseOarSettings(JSON.stringify({ colors: ["Blue", " Green "], maxRings: 4 }))).toEqual({
      colors: [
        { name: "Blue", hex: "#2563eb" },
        { name: "Green", hex: "#16a34a" },
      ],
      maxRings: 4,
      sets: [],
    });
  });

  it("keeps the club's own colors and drops repeats", () => {
    const s = parseOarSettings(
      JSON.stringify({ colors: [{ name: "neon green", hex: "#39FF14" }, "Blue", "blue", { name: "Bad", hex: "red" }] })
    );
    expect(s.colors).toEqual([
      { name: "Neon green", hex: "#39ff14" },
      { name: "Blue", hex: "#2563eb" },
      { name: "Bad", hex: "#9ca3af" },
    ]);
  });

  it("reads oar sets, dropping bad ones and unknown squads", () => {
    const s = parseOarSettings(
      JSON.stringify({
        colors: ["Green", "Red"],
        maxRings: 2,
        sets: [
          { id: "a", color: "green", rings: 1, groups: ["mens", "masters", "nope"] },
          { id: "b", color: "Green", rings: 1, groups: [] }, // repeat
          { id: "c", color: "Pink", rings: 1 }, // not a club color
          { id: "d", color: "Red", rings: 0 },
          { id: "e", color: "Red", rings: 5, groups: ["womens"], note: " spare " },
        ],
      })
    );
    expect(s.sets).toEqual([
      { id: "a", color: "Green", rings: 1, groups: ["mens", "masters"], boats: [], note: "" },
      { id: "e", color: "Red", rings: 5, groups: ["womens"], boats: [], note: "spare" },
    ]);
    expect(s.maxRings).toBe(5); // raised to fit the biggest set
  });
});

describe("oar sets on the sheet", () => {
  const settings = parseOarSettings(
    JSON.stringify({
      colors: ["Green", "Red", { name: "Teal", hex: "#00ffcc" }],
      sets: [
        { id: "a", color: "Green", rings: 1, groups: ["mens"] },
        { id: "b", color: "Red", rings: 2, groups: ["womens", "masters"] },
        { id: "c", color: "Teal", rings: 3, groups: [] },
        { id: "d", color: "Red", rings: 4, groups: ["womens"], boats: ["chase", "osu", "osu"] },
      ],
    })
  );

  it("filters by any picked squad; untagged sets always show", () => {
    expect(oarSetsFor(settings.sets, ["mens"]).map((s) => s.id)).toEqual(["a", "c"]);
    expect(oarSetsFor(settings.sets, ["mens", "masters"]).map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(oarSetsFor(settings.sets, ["womens", "masters"]).map((s) => s.id)).toEqual(["b", "d", "c"]);
    expect(oarSetsFor(settings.sets, []).length).toBe(4);
  });

  it("can go with several boats; that boat's sets show first, whatever the squad", () => {
    expect(settings.sets.find((s) => s.id === "d")?.boats).toEqual(["chase", "osu"]);
    expect(oarSetsFor(settings.sets, ["mens"], "osu").map((s) => s.id)).toEqual(["d", "a", "c"]);
    expect(oarSetsFor(settings.sets, [], "chase")[0].id).toBe("d");
  });

  it("only allows listed sets once there is a list", () => {
    expect(oarAllowed(settings, "Green", 1)).toBe(true);
    expect(oarAllowed(settings, "Green", 2)).toBe(false);
    const noList = parseOarSettings(JSON.stringify({ colors: ["Green"], maxRings: 3 }));
    expect(oarAllowed(noList, "Green", 3)).toBe(true);
    expect(oarAllowed(noList, "Green", 4)).toBe(false);
    expect(oarAllowed(noList, "Red", 1)).toBe(false);
  });

  it("uses the club's shade for its own colors", () => {
    expect(tapeSwatch("Teal", settings.colors)).toBe("#00ffcc");
    expect(tapeSwatch("Green", settings.colors)).toBe("#16a34a");
    expect(tapeSwatch("Mystery")).toBe("#9ca3af");
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
