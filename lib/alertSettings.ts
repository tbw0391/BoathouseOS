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
    detail: "Phone alert to the crew's parents when their boat starts tracking.",
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
