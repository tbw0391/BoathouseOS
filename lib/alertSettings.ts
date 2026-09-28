// Club-wide on/off switches for each kind of alert, set by admins on /admin
// and stored in club_settings as "alert_settings" (JSON). Anything missing
// counts as on.
export const ALERT_TYPES = [
  { kind: "chat_message", label: "Chat messages", detail: "Phone alert to the other people in a chat." },
  { kind: "schedule_new", label: "New schedule events", detail: "Phone alert to everyone." },
  {
    kind: "schedule_change",
    label: "Schedule time/place changes",
    detail: "Phone alert to everyone when an event's time or location changes.",
  },
  { kind: "announcement", label: "Coach announcements", detail: "Phone alert to the announcement's audience." },
  { kind: "food_published", label: "Food list published", detail: "Phone alert to parents and guardians." },
  { kind: "photo_comment", label: "Photo comments", detail: "Phone alert to whoever posted the photo." },
  {
    kind: "boat_on_water",
    label: "Boat on the water",
    detail: "Phone alert to the crew's parents, and anyone following the boat, when it starts tracking.",
  },
  {
    kind: "lightning_hold",
    label: "Lightning hold",
    detail: "Phone alert to everyone when a coach calls boats off the water for lightning, and when it's clear.",
  },
  {
    kind: "practice_call",
    label: "Today's practice call",
    detail: "Phone alert to everyone when a coach calls practice on, moves it to land, or cancels it.",
  },
  {
    kind: "paperwork_expiring",
    label: "Paperwork running out",
    detail: "Phone alert to the member and their parents 30 days before and on the day paperwork runs out.",
  },
  {
    kind: "launch_soon",
    label: "Launch reminder",
    detail: "Phone alert to the crew and their parents 15 minutes before a race's launch time.",
  },
  {
    kind: "food_draft",
    label: "Food list draft ready",
    detail: "Phone alert to tent leaders when the week-out draft is waiting.",
  },
  {
    kind: "payment_due",
    label: "Payment due / overdue",
    detail: "Phone alert to the family 3 days before a bill is due, and the day after if unpaid.",
  },
  {
    kind: "payment_failed",
    label: "Automatic payment failed",
    detail: "Phone alert to the family and the treasurer when an installment is declined.",
  },
  {
    kind: "regatta_week_popup",
    label: "Regatta-week pop-up",
    detail: "Once-a-day reminder on the home page the week before a regatta.",
  },
] as const;

export type AlertKind = (typeof ALERT_TYPES)[number]["kind"];

export const ALERT_SETTINGS_KEY = "alert_settings";

export function parseAlertSettings(raw: string | null | undefined): Record<AlertKind, boolean> {
  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(raw ?? "{}");
  } catch {
    saved = {};
  }
  return Object.fromEntries(
    ALERT_TYPES.map((t) => [t.kind, saved[t.kind] !== false])
  ) as Record<AlertKind, boolean>;
}
