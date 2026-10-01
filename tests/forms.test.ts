import { describe, expect, it } from "vitest";
import { answerText, fileNameFromPath, formIsOpen, tally } from "@/lib/forms";
import { householdOf } from "@/lib/formAlerts";

describe("formIsOpen", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  it("is open with no closing time", () => {
    expect(formIsOpen({ closed_at: null, closes_at: null }, now)).toBe(true);
  });
  it("closes at its closing time", () => {
    expect(formIsOpen({ closed_at: null, closes_at: "2026-10-01T13:00:00Z" }, now)).toBe(true);
    expect(formIsOpen({ closed_at: null, closes_at: "2026-10-01T11:00:00Z" }, now)).toBe(false);
  });
  it("is closed once closed by hand", () => {
    expect(formIsOpen({ closed_at: "2026-09-30T00:00:00Z", closes_at: null }, now)).toBe(false);
  });
});

describe("tally", () => {
  it("counts picks in option order, ignoring unknown ones", () => {
    const q = { kind: "checkboxes" as const, options: ["S", "M", "L"] };
    expect(tally(q, [["M"], ["S", "M"], undefined, ["XL"]])).toEqual([
      { option: "S", count: 1 },
      { option: "M", count: 2 },
      { option: "L", count: 0 },
    ]);
  });
  it("uses Yes/No for yes-no questions", () => {
    expect(tally({ kind: "yes_no", options: [] }, ["Yes", "No", "Yes"])).toEqual([
      { option: "Yes", count: 2 },
      { option: "No", count: 1 },
    ]);
  });
});

describe("answerText", () => {
  it("joins checkbox picks and shows file names", () => {
    expect(answerText({ kind: "checkboxes" }, ["A", "B"])).toBe("A; B");
    expect(answerText({ kind: "file" }, "club/form/me/1727790000000-waiver.pdf")).toBe("waiver.pdf");
    expect(fileNameFromPath("x/1-a-b.png")).toBe("a-b.png");
    expect(answerText({ kind: "short" }, undefined)).toBe("");
  });
});

describe("householdOf (one vote per family)", () => {
  // Mom and Dad (spouses) guard Kid; Grandma also guards Kid; Aunt guards Cousin.
  const links = [
    { guardian_id: "mom", rower_id: "kid" },
    { guardian_id: "grandma", rower_id: "kid" },
    { guardian_id: "aunt", rower_id: "cousin" },
  ];
  const spouseOf = new Map([
    ["mom", "dad"],
    ["dad", "mom"],
  ]);
  it("groups spouses, their rowers and the rowers' other guardians", () => {
    expect([...householdOf("dad", links, spouseOf)].sort()).toEqual(["dad", "grandma", "kid", "mom"]);
    expect([...householdOf("kid", links, spouseOf)].sort()).toEqual(["dad", "grandma", "kid", "mom"]);
  });
  it("keeps other families apart", () => {
    expect([...householdOf("aunt", links, spouseOf)].sort()).toEqual(["aunt", "cousin"]);
    expect([...householdOf("coach", links, spouseOf)]).toEqual(["coach"]);
  });
});
