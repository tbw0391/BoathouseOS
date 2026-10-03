import { describe, expect, it } from "vitest";
import { ALERT_TYPES, parseAlertSettings } from "@/lib/alertSettings";
import { isPushServiceEndpoint } from "@/lib/push";

describe("parseAlertSettings", () => {
  it("treats every alert as on unless switched off (except default-off ones)", () => {
    const defaults = parseAlertSettings(null);
    expect(Object.entries(defaults).filter(([, on]) => !on).map(([k]) => k)).toEqual(["course_split"]);
    expect(parseAlertSettings('{"course_split": true}').course_split).toBe(true);
    const s = parseAlertSettings('{"chat_message": false}');
    expect(s.chat_message).toBe(false);
    expect(s.schedule_new).toBe(true);
    expect(Object.keys(s)).toHaveLength(ALERT_TYPES.length);
  });
  it("falls back to the defaults for a corrupt setting", () => {
    expect(parseAlertSettings("{not json")).toEqual(parseAlertSettings(null));
  });
});

describe("isPushServiceEndpoint", () => {
  it("accepts the real browser push services", () => {
    for (const e of [
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://updates.push.services.mozilla.com/wpush/v2/x",
      "https://web.push.apple.com/QGx",
      "https://wns2-bn3p.notify.windows.com/w/?token=x",
    ]) {
      expect(isPushServiceEndpoint(e)).toBe(true);
    }
  });
  it("refuses anything else", () => {
    for (const e of [
      "https://evil.example/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.example/x",
      "https://fcm.googleapis.com:8443/x",
      "http://fcm.googleapis.com/x",
      "https://169.254.169.254/latest",
      "not a url",
    ]) {
      expect(isPushServiceEndpoint(e)).toBe(false);
    }
  });
});
