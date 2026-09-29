import { describe, expect, it } from "vitest";
import { UserError, tryAction, unwrap, unwrapIfResult } from "@/lib/userError";

describe("tryAction", () => {
  it("returns the value, or a person-facing message as { error }", async () => {
    expect(await tryAction(async () => 5)).toEqual({ ok: true, value: 5 });
    expect(await tryAction(async () => {
      throw new UserError("Enter a US mobile number.");
    })).toEqual({ ok: false, error: "Enter a US mobile number." });
  });

  it("still throws real bugs (so they stay hidden on the live site)", async () => {
    await expect(tryAction(async () => {
      throw new Error("db exploded");
    })).rejects.toThrow("db exploded");
  });
});

describe("unwrap", () => {
  it("gives back the value or throws the message in the browser", () => {
    expect(unwrap({ ok: true, value: "x" })).toBe("x");
    expect(() => unwrap({ ok: false, error: "Nope." })).toThrow("Nope.");
    expect(unwrapIfResult(undefined)).toBeUndefined();
    expect(() => unwrapIfResult({ ok: false, error: "Nope." })).toThrow("Nope.");
  });
});
