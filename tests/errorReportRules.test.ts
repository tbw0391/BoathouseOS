import { describe, expect, it } from "vitest";
import { groupingKey, shortStack, shouldReport } from "@/lib/errorReportRules";
import { UserError } from "@/lib/userError";

describe("shouldReport", () => {
  it("reports real bugs", () => {
    expect(shouldReport(new Error("relation \"boats\" does not exist"))).toBe(true);
    expect(shouldReport("a thrown string")).toBe(true);
  });

  it("skips messages the person can fix", () => {
    expect(shouldReport(new UserError("Enter a US mobile number."))).toBe(false);
  });

  it("skips Next.js redirects, not-founds and stale pages after a deploy", () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    const missing = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(shouldReport(redirect)).toBe(false);
    expect(shouldReport(missing)).toBe(false);
    expect(shouldReport(new Error('Failed to find Server Action "abc123".'))).toBe(false);
  });
});

describe("groupingKey", () => {
  it("groups the same error even when ids or counts differ", () => {
    const a = groupingKey("Boat 3f1c2a4e-1111-4222-8333-444455556666 not found (row 12)", "/boats/[id]");
    const b = groupingKey("Boat 9a9a9a9a-aaaa-4bbb-8ccc-dddddddddddd not found (row 7)", "/boats/[id]");
    expect(a).toBe(b);
  });

  it("keeps the same message on different pages apart", () => {
    expect(groupingKey("oops", "/boats")).not.toBe(groupingKey("oops", "/lineups"));
  });
});

describe("shortStack", () => {
  it("keeps the message line and the top frames", () => {
    const stack = ["Error: oops", ...Array.from({ length: 20 }, (_, i) => `    at f${i}`)].join("\n");
    expect(shortStack(stack, 3)).toBe("Error: oops\n    at f0\n    at f1\n    at f2");
    expect(shortStack(undefined)).toBeNull();
  });
});
