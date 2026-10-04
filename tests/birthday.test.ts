import { describe, expect, it } from "vitest";
import {
  NO_YEAR,
  birthdayHasYear,
  birthdayLabel,
  fullBirthdate,
  monthDayBirthday,
  monthDayOnly,
  parseBirthdaySettings,
} from "@/lib/birthday";

describe("parent birthdays without a year", () => {
  it("is off unless an admin turns it on, and only for parents", () => {
    expect(parseBirthdaySettings(null)).toEqual({ parentsNoYear: false });
    expect(parseBirthdaySettings("junk")).toEqual({ parentsNoYear: false });
    const on = parseBirthdaySettings('{"parentsNoYear":true}');
    expect(monthDayOnly("parent", on)).toBe(true);
    expect(monthDayOnly("rower", on)).toBe(false);
    expect(monthDayOnly("parent", { parentsNoYear: false })).toBe(false);
  });

  it("stores month and day in the no-year year, Feb 29 included", () => {
    expect(monthDayBirthday("10", "4")).toBe(`${NO_YEAR}-10-04`);
    expect(monthDayBirthday("2", "29")).toBe(`${NO_YEAR}-02-29`);
    expect(monthDayBirthday("", "4")).toBeNull();
    expect(() => monthDayBirthday("4", "31")).toThrow();
  });

  it("never shows the no-year year, and can hide a real one", () => {
    expect(birthdayLabel(`${NO_YEAR}-10-04`)).toBe("October 4");
    expect(birthdayLabel("1980-10-04")).toBe("October 4, 1980");
    expect(birthdayLabel("1980-10-04", true)).toBe("October 4");
    expect(birthdayLabel(null)).toBeNull();
  });

  it("gives no date of birth when the year isn't known", () => {
    expect(birthdayHasYear(`${NO_YEAR}-10-04`)).toBe(false);
    expect(fullBirthdate(`${NO_YEAR}-10-04`)).toBeNull();
    expect(fullBirthdate("2010-05-01")).toBe("2010-05-01");
  });
});
