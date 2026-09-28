import { describe, expect, it } from "vitest";
import {
  PROFILE_BUTTONS_KEY,
  PROFILE_KNOWN_KEY,
  orderProfileButtons,
  profileButtonsFor,
  profileButtonsForMember,
  resolveProfileButtons,
} from "@/lib/profileButtons";

const settings = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe("resolveProfileButtons", () => {
  it("starts each group at its defaults", () => {
    const a = resolveProfileButtons(settings({}));
    expect(a.rower).toContain("/workouts");
    expect(a.parent).toContain("/payments");
    expect(a.coach).toContain("/coach/attendance");
    expect(a.board).toContain("/polls");
  });

  it("uses the saved lists once they exist, dropping buttons a group can't use", () => {
    const a = resolveProfileButtons(
      settings({ [PROFILE_BUTTONS_KEY]: JSON.stringify({ rower: ["/photos", "/coach/attendance"] }) })
    );
    expect(a.rower).toEqual(["/photos"]);
  });

  it("gives a button added after saving its default", () => {
    const a = resolveProfileButtons(
      settings({ [PROFILE_BUTTONS_KEY]: JSON.stringify({ rower: [], [PROFILE_KNOWN_KEY]: ["/photos"] }) })
    );
    expect(a.rower).toContain("/workouts");
    expect(a.rower).not.toContain("/photos");
  });
});

describe("profileButtonsFor", () => {
  it("keeps coach and admin pages out of the board list", () => {
    const hrefs = profileButtonsFor("board").map((b) => b.href);
    expect(hrefs).not.toContain("/coach/attendance");
    expect(hrefs).not.toContain("/admin");
  });
});

describe("profileButtonsForMember", () => {
  it("adds the board buttons for board members", () => {
    const access = resolveProfileButtons(settings({}));
    const hrefs = profileButtonsForMember(access, "parent", true).map((b) => b.href);
    expect(hrefs).toContain("/payments");
    expect(hrefs).toContain("/polls");
    expect(profileButtonsForMember(access, "parent", false).map((b) => b.href)).not.toContain("/polls");
  });
});

describe("orderProfileButtons", () => {
  const buttons = [
    { href: "/a", label: "A" },
    { href: "/b", label: "B" },
    { href: "/c", label: "C" },
    { href: "/d", label: "D" },
  ];

  it("keeps the club order with no saved order", () => {
    expect(orderProfileButtons(buttons, null)).toEqual(buttons);
  });

  it("follows the saved order and puts new buttons at the end in club order", () => {
    const hrefs = orderProfileButtons(buttons, ["/c", "/gone", "/a"]).map((b) => b.href);
    expect(hrefs).toEqual(["/c", "/a", "/b", "/d"]);
  });
});
