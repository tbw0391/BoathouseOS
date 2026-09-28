import { describe, expect, it } from "vitest";
import { NAV_ACCESS_KEY, resolveNavAccess } from "@/lib/navSections";

const settings = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe("resolveNavAccess", () => {
  it("carries over the old per-button setting until roles are saved", () => {
    const a = resolveNavAccess(settings({ nav_visibility: JSON.stringify({ "/payments": "coaches", "/polls": "off", "/photos": "admins" }) }));
    expect(a.rower).not.toContain("/payments");
    expect(a.coach).toContain("/payments");
    expect(a.admin).toContain("/photos");
    expect(a.coach).not.toContain("/photos");
    expect(a.admin).not.toContain("/polls");
    expect(a.parent).toContain("/schedule");
  });

  it("uses the saved per-role lists once they exist", () => {
    const a = resolveNavAccess(settings({ [NAV_ACCESS_KEY]: JSON.stringify({ parent: ["/schedule", "/food-tent"] }) }));
    expect(a.parent).toEqual(["/food-tent", "/schedule"].sort((x, y) => a.parent.indexOf(x) - a.parent.indexOf(y)));
    expect(a.parent).toHaveLength(2);
  });

  it("never gives the Coach page to rowers, coxswains or parents", () => {
    const a = resolveNavAccess(settings({ [NAV_ACCESS_KEY]: JSON.stringify({ rower: ["/coach", "/schedule"] }) }));
    expect(a.rower).toEqual(["/schedule"]);
    expect(resolveNavAccess(settings({})).coach).toContain("/coach");
    expect(resolveNavAccess(settings({})).parent).not.toContain("/coach");
  });
});
