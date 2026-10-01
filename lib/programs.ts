// Program registration on the club website (0117): camps, Learn to Row,
// seasons. Shared by the site, Admin Settings > Website > Programs and tests.

export type ProgramQuestionKind = "short" | "long" | "yes_no" | "choice";

export const PROGRAM_QUESTION_KINDS: { value: ProgramQuestionKind; label: string }[] = [
  { value: "short", label: "Short answer" },
  { value: "long", label: "Paragraph" },
  { value: "yes_no", label: "Yes / No" },
  { value: "choice", label: "Pick one" },
];

export interface ProgramQuestion {
  id: string;
  label: string;
  kind: ProgramQuestionKind;
  options: string[];
  required: boolean;
}

export interface Program {
  id: string;
  club_id: string;
  slug: string;
  title: string;
  description: string;
  starts_on: string | null;
  ends_on: string | null;
  schedule: string | null;
  ages: string | null;
  price_cents: number | null;
  capacity: number | null;
  opens_at: string | null;
  closes_at: string | null;
  published: boolean;
  waiver: string | null;
  questions: ProgramQuestion[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type RegistrationStatus = "registered" | "waitlist" | "cancelled";

export interface ProgramRegistration {
  id: string;
  club_id: string;
  program_id: string;
  status: RegistrationStatus;
  participant_name: string;
  participant_birthdate: string | null;
  guardian_name: string | null;
  email: string;
  phone: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  medical_notes: string | null;
  answers: Record<string, string>;
  waiver_accepted_at: string | null;
  paid_at: string | null;
  notes: string | null;
  // The member registered, when signed up in the app (0120).
  profile_id: string | null;
  registered_by: string | null;
  created_at: string;
}

// Questions saved as JSON; anything malformed is dropped.
export function parseProgramQuestions(raw: unknown): ProgramQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((q) => {
    if (!q || typeof q !== "object") return [];
    const { id, label, kind, options, required } = q as Record<string, unknown>;
    if (typeof id !== "string" || typeof label !== "string" || !label.trim()) return [];
    if (!PROGRAM_QUESTION_KINDS.some((k) => k.value === kind)) return [];
    return [
      {
        id,
        label,
        kind: kind as ProgramQuestionKind,
        options: Array.isArray(options) ? options.filter((o): o is string => typeof o === "string" && !!o.trim()) : [],
        required: required === true,
      },
    ];
  });
}

export type ProgramState = "draft" | "not_yet" | "open" | "closed";

export function programState(p: Pick<Program, "published" | "opens_at" | "closes_at">, now = new Date()): ProgramState {
  if (!p.published) return "draft";
  if (p.opens_at && new Date(p.opens_at) > now) return "not_yet";
  if (p.closes_at && new Date(p.closes_at) <= now) return "closed";
  return "open";
}

// Spots left, or null with no limit.
export function spotsLeft(capacity: number | null, registered: number): number | null {
  return capacity === null ? null : Math.max(0, capacity - registered);
}

export function formatPrice(cents: number | null): string | null {
  if (cents === null) return null;
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

// "Jun 15 – Jun 19, 2027", "Jun 15, 2027", or null.
export function formatProgramDates(startsOn: string | null, endsOn: string | null): string | null {
  const fmt = (d: string, year: boolean) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      ...(year ? { year: "numeric" } : {}),
    });
  if (startsOn && endsOn && endsOn !== startsOn) {
    const sameYear = startsOn.slice(0, 4) === endsOn.slice(0, 4);
    return `${fmt(startsOn, !sameYear)} – ${fmt(endsOn, true)}`;
  }
  const one = startsOn ?? endsOn;
  return one ? fmt(one, true) : null;
}

// Eastern time, like the rest of the app.
export function formatWhenEastern(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
