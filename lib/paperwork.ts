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
  { kind: "safesport", label: "SafeSport training", short: "SafeSport", roles: ["coach", "admin"], validMonths: 12 },
  { kind: "background_check", label: "Background check", short: "Bkgd", roles: ["coach", "admin"], validMonths: 24 },
];

export const EXPIRING_DAYS = 30;

export type PaperworkRecord = { kind: string; completed_on: string | null; expires_on: string | null; checked_by?: string | null };
export type PaperworkStatus = "ok" | "expiring" | "expired" | "missing";

export function requiredFor(role: string) {
  return PAPERWORK.filter((p) => p.roles.includes(role));
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
