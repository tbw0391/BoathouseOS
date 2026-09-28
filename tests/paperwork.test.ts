import { describe, expect, it } from "vitest";
import { paperworkStatus, requiredFor, suggestedExpiry } from "@/lib/paperwork";

describe("paperworkStatus", () => {
  const today = "2026-09-28";
  it("reads missing, done, running out and expired", () => {
    expect(paperworkStatus(null, today)).toBe("missing");
    expect(paperworkStatus({ kind: "waiver", completed_on: null, expires_on: null }, today)).toBe("missing");
    expect(paperworkStatus({ kind: "swim_test", completed_on: "2025-06-01", expires_on: null }, today)).toBe("ok");
    expect(paperworkStatus({ kind: "waiver", completed_on: null, expires_on: "2026-12-31" }, today)).toBe("ok");
    expect(paperworkStatus({ kind: "waiver", completed_on: null, expires_on: "2026-10-20" }, today)).toBe("expiring");
    expect(paperworkStatus({ kind: "waiver", completed_on: null, expires_on: "2026-09-27" }, today)).toBe("expired");
    expect(paperworkStatus({ kind: "waiver", completed_on: null, expires_on: today }, today)).toBe("expiring");
  });
});

describe("requiredFor", () => {
  it("asks rowers for the swim test and coaches for SafeSport", () => {
    expect(requiredFor("rower").map((p) => p.kind)).toContain("swim_test");
    expect(requiredFor("rower").map((p) => p.kind)).not.toContain("safesport");
    expect(requiredFor("coach").map((p) => p.kind)).toContain("background_check");
    expect(requiredFor("parent")).toEqual([]);
  });
});

describe("suggestedExpiry", () => {
  it("adds the usual length, or none for a swim test", () => {
    expect(suggestedExpiry("waiver", "2026-01-15")).toBe("2027-01-15");
    expect(suggestedExpiry("background_check", "2026-01-15")).toBe("2028-01-15");
    expect(suggestedExpiry("swim_test", "2026-01-15")).toBeNull();
  });
});
