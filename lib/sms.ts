import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";

// Sends texts through Twilio's REST API. Needs TWILIO_ACCOUNT_SID,
// TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER; without them nothing is sent.

// The Twilio settings, forgiving of how they were pasted into Vercel: stray
// spaces, line breaks or quotes around them, and a From number typed like
// (614) 819-3351.
function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

function twilioSettings() {
  const digits = clean(process.env.TWILIO_FROM_NUMBER).replace(/[^\d+]/g, "");
  const from = digits.startsWith("+") ? digits : digits.length === 10 ? `+1${digits}` : digits ? `+${digits}` : "";
  return {
    sid: clean(process.env.TWILIO_ACCOUNT_SID),
    token: clean(process.env.TWILIO_AUTH_TOKEN),
    from,
  };
}

export function smsConfigured(): boolean {
  const t = twilioSettings();
  return !!t.sid && !!t.token && !!t.from;
}

// Twilio error 21610: the number replied STOP, so Twilio won't text it.
const OPTED_OUT = 21610;

// One text per number. Never throws; returns how many Twilio accepted.
// Numbers that have opted out at Twilio are marked opted out here too.
export async function sendTexts(
  admin: ReturnType<typeof createAdminClient>,
  phones: string[],
  body: string
): Promise<number> {
  if (!smsConfigured() || phones.length === 0) return 0;
  let accepted = 0;
  const { sid, token, from } = twilioSettings();
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const optedOut: string[] = [];
  await Promise.allSettled(
    [...new Set(phones)].map(async (to) => {
      try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: to, From: from, Body: body }),
        });
        if (res.ok) accepted++;
        else {
          const err = (await res.json().catch(() => null)) as { code?: number; message?: string } | null;
          if (err?.code === OPTED_OUT) optedOut.push(to);
          else console.error("Text failed", res.status, err?.code, err?.message);
        }
      } catch (e) {
        console.error("Text failed", e);
      }
    })
  );
  if (optedOut.length > 0) {
    await admin
      .from("sms_consents")
      .update({ opted_out_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in("phone", optedOut)
      .is("opted_out_at", null);
  }
  return accepted;
}

// Checks X-Twilio-Signature: base64 HMAC-SHA1 (auth token) of the full URL
// followed by each POST field name and value, sorted by name.
export function validTwilioSignature(url: string, params: Record<string, string>, signature: string): boolean {
  const { token } = twilioSettings();
  if (!token || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", token).update(data).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// One text, reporting Twilio's reason if it's refused (for the profile's
// "Send me a test text"). Returns null when Twilio accepted it.
export async function sendTextReport(to: string, body: string): Promise<string | null> {
  if (!smsConfigured()) return "Texting isn't set up (Twilio settings missing).";
  const { sid, token, from } = twilioSettings();
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (res.ok) return null;
    const err = (await res.json().catch(() => null)) as { code?: number; message?: string } | null;
    return `Twilio said: ${err?.message ?? `error ${res.status}`}${err?.code ? ` (code ${err.code})` : ""}`;
  } catch (e) {
    return `Couldn't reach Twilio: ${e instanceof Error ? e.message : "network error"}`;
  }
}
