import { describe, expect, it } from "vitest";
import { cleanRecruitFields, isAdult, listingBlocker } from "@/lib/recruiting";

const today = new Date(2026, 9, 1);
const member = { role: "rower", birthday: "2008-06-01", approved_at: "2026-01-01", disabled_at: null };

describe("isAdult", () => {
  it("counts from the birthday, and no birthday as under 18", () => {
    expect(isAdult("2008-10-01", today)).toBe(true);
    expect(isAdult("2008-10-02", today)).toBe(false);
    expect(isAdult(null, today)).toBe(false);
  });
});

describe("listingBlocker", () => {
  it("needs the club on, a listed current athlete, and a parent for under-18s", () => {
    const listing = { shown: true, parent_approved_at: null };
    expect(listingBlocker(listing, member, false)).toMatch(/club/);
    expect(listingBlocker({ shown: false, parent_approved_at: null }, member, true)).toBe("Not listed.");
    expect(listingBlocker(listing, { ...member, role: "parent" }, true)).toMatch(/rowers and coxswains/);
    expect(listingBlocker(listing, { ...member, disabled_at: "2026-02-01" }, true)).toMatch(/current members/);
    expect(listingBlocker(listing, { ...member, birthday: null }, true)).toMatch(/parent/);
    expect(listingBlocker({ shown: true, parent_approved_at: "2026-09-01" }, { ...member, birthday: null }, true)).toBeNull();
    expect(listingBlocker(listing, { ...member, birthday: "2000-01-01" }, true)).toBeNull();
  });
});

describe("cleanRecruitFields", () => {
  it("keeps only known fields, once each", () => {
    expect(cleanRecruitFields(["erg_2k", "email", "erg_2k", "birthday", "gpa"])).toEqual(["erg_2k", "gpa"]);
  });
});
