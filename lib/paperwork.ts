// Member paperwork (Coach > Paperwork, and each member's profile): what each
// type of member needs, and whether it's done, running out, or missing.

export type PaperworkKind = "usrowing" | "waiver" | "swim_test" | "safesport" | "background_check";

export const PAPERWORK: {
  kind: PaperworkKind;
  label: string;
  short: string;
  roles: string[];
  // Typical length, used to suggest an expiry date; null = doesn't expire.
  validMonths: number | null;
}[] = [
  { kind: "usrowing", label: "USRowing membership", short: "USR", roles: ["rower", "coxswain", "coach"], validMonths: 12 },
  { kind: "waiver", label: "USRowing waiver", short: "Waiver", roles: ["rower", "coxswain", "coach"], validMonths: 12 },
  { kind: "swim_test", label: "Swim test", short: "Swim", roles: ["rower", "coxswain"], validMonths: null },
  { kind: "safesport", label: "SafeSport training", short: "SafeSport", roles: ["coach"], validMonths: 12 },
  { kind: "background_check", label: "Background check", short: "Bkgd", roles: ["coach"], validMonths: 24 },
];

export const EXPIRING_DAYS = 30;

export type PaperworkRecord = { kind: string; completed_on: string | null; expires_on: string | null; checked_by?: string | null };
export type PaperworkStatus = "ok" | "expiring" | "expired" | "missing";

// Who needs what, and whether parents see their child's paperwork, are picked
// per club in Admin Settings (club_settings "paperwork_settings"); `roles`
// above are the defaults. Admins on the Coach team count as coaches.
export const PAPERWORK_SETTINGS_KEY = "paperwork_settings";
export const PAPERWORK_ROLES = [
  { role: "rower", label: "Rowers" },
  { role: "coxswain", label: "Coxswains" },
  { role: "coach", label: "Coaches (and admins on the Coach team)" },
  { role: "admin", label: "All admins" },
] as const;

export type PaperworkSettings = {
  required: Record<PaperworkKind, string[]>;
  parentsSeeChild: boolean;
};

export function parsePaperworkSettings(raw: string | null | undefined): PaperworkSettings {
  const settings: PaperworkSettings = {
    required: Object.fromEntries(PAPERWORK.map((p) => [p.kind, [...p.roles]])) as Record<PaperworkKind, string[]>,
    parentsSeeChild: true,
  };
  if (!raw) return settings;
  try {
    const saved = JSON.parse(raw) as Partial<PaperworkSettings>;
    for (const p of PAPERWORK) {
      const roles = saved.required?.[p.kind];
      if (Array.isArray(roles)) settings.required[p.kind] = roles.filter((r) => typeof r === "string");
    }
    if (typeof saved.parentsSeeChild === "boolean") settings.parentsSeeChild = saved.parentsSeeChild;
  } catch {
    // Unreadable: the defaults.
  }
  return settings;
}

export function requiredFor(role: string, settings: PaperworkSettings = parsePaperworkSettings(null), teams: readonly string[] = []) {
  const roles = role === "admin" && teams.includes("coach") ? ["admin", "coach"] : [role];
  return PAPERWORK.filter((p) => settings.required[p.kind].some((r) => roles.includes(r)));
}

function addDays(dateKey: string, n: number) {
  return new Date(new Date(`${dateKey}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
}

export function paperworkStatus(record: PaperworkRecord | null | undefined, todayKey: string): PaperworkStatus {
  if (!record || (!record.completed_on && !record.expires_on)) return "missing";
  if (!record.expires_on) return "ok";
  if (record.expires_on < todayKey) return "expired";
  if (record.expires_on <= addDays(todayKey, EXPIRING_DAYS)) return "expiring";
  return "ok";
}

export function suggestedExpiry(kind: PaperworkKind, completedOn: string): string | null {
  const months = PAPERWORK.find((p) => p.kind === kind)?.validMonths;
  if (!months) return null;
  const d = new Date(`${completedOn}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export const STATUS_STYLE: Record<PaperworkStatus, { label: string; className: string }> = {
  ok: { label: "Done", className: "bg-green-100 text-green-800" },
  expiring: { label: "Running out", className: "bg-amber-100 text-amber-800" },
  expired: { label: "Expired", className: "bg-red-100 text-red-800" },
  missing: { label: "Missing", className: "bg-gray-100 text-gray-600" },
};
