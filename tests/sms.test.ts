import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { canOptInToTexts, formatUsPhone, normalizeUsPhone, smsBody } from "@/lib/smsRules";
import { validTwilioSignature } from "@/lib/sms";

describe("normalizeUsPhone", () => {
  it("accepts the usual ways people type a number", () => {
    expect(normalizeUsPhone("(614) 555-1234")).toBe("+16145551234");
    expect(normalizeUsPhone("614.555.1234")).toBe("+16145551234");
    expect(normalizeUsPhone("+1 614 555 1234")).toBe("+16145551234");
  });

  it("rejects numbers that can't be US mobiles", () => {
    expect(normalizeUsPhone("555-1234")).toBeNull();
    expect(normalizeUsPhone("(014) 555-1234")).toBeNull();
    expect(normalizeUsPhone("+44 20 7946 0958")).toBeNull();
  });

  it("formats for display", () => {
    expect(formatUsPhone("+16145551234")).toBe("(614) 555-1234");
  });
});

describe("canOptInToTexts", () => {
  const today = new Date(2026, 8, 28);
  it("lets adults and non-rowers opt in", () => {
    expect(canOptInToTexts("parent", null, today)).toBe(true);
    expect(canOptInToTexts("coach", null, today)).toBe(true);
    expect(canOptInToTexts("rower", "2008-09-28", today)).toBe(true);
  });

  it("keeps rowers and coxes under 18 (or with no birthday) out", () => {
    expect(canOptInToTexts("rower", "2008-09-29", today)).toBe(false);
    expect(canOptInToTexts("coxswain", null, today)).toBe(false);
  });
});

it("builds a text with the opt-out line", () => {
  expect(smsBody("Lightning hold", "Everyone off the water.")).toBe(
    "BoathouseOS: Lightning hold. Everyone off the water. Reply STOP to opt out."
  );
});

describe("validTwilioSignature", () => {
  const old = process.env.TWILIO_AUTH_TOKEN;
  afterEach(() => {
    process.env.TWILIO_AUTH_TOKEN = old;
  });

  it("accepts Twilio's signature and rejects a tampered one", () => {
    process.env.TWILIO_AUTH_TOKEN = "secret";
    const url = "https://www.boathouseos.app/api/twilio/inbound";
    const params = { From: "+16145551234", Body: "STOP" };
    const sig = createHmac("sha1", "secret").update(`${url}BodySTOPFrom+16145551234`).digest("base64");
    expect(validTwilioSignature(url, params, sig)).toBe(true);
    expect(validTwilioSignature(url, { ...params, Body: "START" }, sig)).toBe(false);
  });
});
