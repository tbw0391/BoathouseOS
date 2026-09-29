import type { AlertKind } from "@/lib/alertSettings";

// Text (SMS) alerts: which alerts go by text, who may opt in, and the
// consent wording shown on the profile (kept word for word with each
// consent, as carriers require).

// Only the urgent ones: texts cost money and people tune out.
export const SMS_KINDS: AlertKind[] = ["lightning_hold", "practice_call", "launch_soon"];

export const SMS_CONSENT_TEXT =
  "I agree to get text message alerts from BoathouseOS for my rowing club: lightning holds, " +
  "today's practice changes, and race launch times. Message frequency varies (usually a few " +
  "a week in season). Msg & data rates may apply. Reply STOP to cancel or HELP for help. " +
  "Agreeing isn't a condition of membership.";

// "(614) 555-1234", "614.555.1234", "+1 614 555 1234" -> "+16145551234";
// anything that isn't a US mobile-shaped number -> null.
export function normalizeUsPhone(text: string): string | null {
  let digits = text.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (!/^[2-9]\d{9}$/.test(digits)) return null;
  return `+1${digits}`;
}

// "+16145551234" -> "(614) 555-1234".
export function formatUsPhone(e164: string): string {
  const d = e164.replace(/^\+1/, "");
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// Rowers and coxswains under 18 don't get texts themselves (Safe Sport):
// their parents do. With no birthday on file we can't tell, so they can't
// opt in until one is added.
export function canOptInToTexts(role: string, birthday: string | null, today: Date = new Date()): boolean {
  if (role !== "rower" && role !== "coxswain") return true;
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false;
  const [y, m, d] = birthday.split("-").map(Number);
  const eighteenth = new Date(y + 18, m - 1, d);
  return eighteenth <= today;
}

// One text: "BoathouseOS: <title>. <body> Reply STOP to opt out."
export function smsBody(title: string, body: string): string {
  const main = `BoathouseOS: ${title.replace(/[.!?]$/, "")}. ${body}`.trim();
  const tail = " Reply STOP to opt out.";
  const max = 300 - tail.length;
  return (main.length > max ? `${main.slice(0, max - 1)}…` : main) + tail;
}
