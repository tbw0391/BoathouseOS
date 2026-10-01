import type { ElectionVoters, Form, FormAudience, FormQuestion, FormQuestionKind } from "@/lib/database.types";

// Forms, surveys and elections (/forms, 0115).

export const FORM_AUDIENCES: { value: FormAudience; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "rowers", label: "Rowers & coxes" },
  { value: "parents", label: "Parents" },
  { value: "coaches", label: "Coaches" },
  { value: "board", label: "Board" },
];

export const ELECTION_VOTERS: { value: ElectionVoters; label: string; detail: string }[] = [
  { value: "everyone", label: "Everyone", detail: "Everyone the election is for gets a vote." },
  { value: "adults", label: "18 and over", detail: "Rowers and coxes need a birthday on their profile showing 18+." },
  {
    value: "family",
    label: "One per family",
    detail: "Spouses, and parents of the same rowers, share one vote. Whoever votes first uses it.",
  },
];

export const QUESTION_KINDS: { value: FormQuestionKind; label: string }[] = [
  { value: "short", label: "Short answer" },
  { value: "long", label: "Paragraph" },
  { value: "choice", label: "Pick one" },
  { value: "checkboxes", label: "Pick any" },
  { value: "yes_no", label: "Yes / No" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "file", label: "File upload" },
];

export const kindHasOptions = (kind: FormQuestionKind) => kind === "choice" || kind === "checkboxes";

export const audienceLabel = (a: FormAudience) => FORM_AUDIENCES.find((x) => x.value === a)?.label ?? a;
export const votersLabel = (v: ElectionVoters) => ELECTION_VOTERS.find((x) => x.value === v)?.label ?? v;

export function formIsOpen(form: Pick<Form, "closed_at" | "closes_at">, now = new Date()): boolean {
  return form.closed_at === null && (form.closes_at === null || new Date(form.closes_at) > now);
}

export function canCreateForms(p: { role: string; is_board_member: boolean } | null): boolean {
  return Boolean(p && (p.role === "admin" || p.role === "coach" || p.is_board_member));
}

export function canCreateElections(p: { role: string; is_board_member: boolean } | null): boolean {
  return Boolean(p && (p.role === "admin" || p.is_board_member));
}

// Eastern time, like the rest of the app's alert times.
export function formatClosing(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// An answer as plain text, for the results table and the CSV. File answers
// are their storage path; the file name is everything after the last "-"
// prefix the upload added.
export function answerText(q: Pick<FormQuestion, "kind">, value: string | string[] | undefined): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join("; ");
  if (q.kind === "file") return fileNameFromPath(value);
  return value;
}

export function fileNameFromPath(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.replace(/^\d+-/, "");
}

// Counts for a pick-one / pick-any / yes-no question, in option order.
export function tally(q: Pick<FormQuestion, "kind" | "options">, values: (string | string[] | undefined)[]) {
  const options = q.kind === "yes_no" ? ["Yes", "No"] : q.options;
  const counts = new Map(options.map((o) => [o, 0]));
  for (const v of values) {
    for (const pick of Array.isArray(v) ? v : v ? [v] : []) {
      if (counts.has(pick)) counts.set(pick, (counts.get(pick) ?? 0) + 1);
    }
  }
  return options.map((o) => ({ option: o, count: counts.get(o) ?? 0 }));
}
