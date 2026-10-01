import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendEmails } from "@/lib/email";
import { formatPrice, parseProgramQuestions, type Program } from "@/lib/programs";
import { UserError } from "@/lib/userError";

// Saving a program registration (0117, 0120), from the website's form or a
// member signing up in the app: decides registered vs waitlist, saves it with
// the service role, and emails the family and the club's admins.

type Admin = ReturnType<typeof createAdminClient>;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// The program's extra questions, checked. get(id) is the submitted answer.
export function checkAnswers(program: Pick<Program, "questions">, get: (questionId: string) => string): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const q of parseProgramQuestions(program.questions)) {
    const value = get(q.id).trim().slice(0, 2000);
    if (value && q.kind === "choice" && !q.options.includes(value)) throw new UserError(`Pick one of the choices for "${q.label}".`);
    if (value && q.kind === "yes_no" && value !== "Yes" && value !== "No") throw new UserError(`Answer yes or no for "${q.label}".`);
    if (q.required && !value) throw new UserError(`Please answer "${q.label}".`);
    if (value) answers[q.id] = value;
  }
  return answers;
}

export interface RegistrationInput {
  participant_name: string;
  participant_birthdate: string | null;
  guardian_name: string | null;
  email: string;
  phone: string | null;
  emergency_name: string;
  emergency_phone: string;
  medical_notes: string | null;
  answers: Record<string, string>;
  profile_id?: string | null;
  registered_by?: string | null;
  ip?: string | null;
}

export async function saveRegistration(
  admin: Admin,
  club: { id: string; name: string },
  program: Program,
  input: RegistrationInput
): Promise<"registered" | "waitlist"> {
  let status: "registered" | "waitlist" = "registered";
  if (program.capacity !== null) {
    const { count: taken } = await admin
      .from("program_registrations")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id)
      .eq("status", "registered");
    if ((taken ?? 0) >= program.capacity) status = "waitlist";
  }

  const { error } = await admin.from("program_registrations").insert({
    club_id: club.id,
    program_id: program.id,
    status,
    ...input,
    waiver_accepted_at: program.waiver ? new Date().toISOString() : null,
  });
  if (error?.code === "23505") throw new UserError(`${input.participant_name} is already signed up for this program.`);
  if (error) throw new UserError("Couldn't save the registration. Please try again.");

  if (emailConfigured()) {
    const html = (lines: string[]) =>
      `<div style="font-family:system-ui,sans-serif;max-width:520px">${lines
        .map((l) => `<p style="margin:0 0 8px;white-space:pre-line">${escapeHtml(l)}</p>`)
        .join("")}</div>`;
    const price = formatPrice(program.price_cents);
    const confirm = [
      status === "waitlist"
        ? `${input.participant_name} is on the waitlist for ${program.title} at ${club.name}. The club will contact you if a spot opens up.`
        : `${input.participant_name} is registered for ${program.title} at ${club.name}.`,
      price && price !== "Free" && status === "registered" ? `Cost: ${price}. The club will be in touch about payment.` : null,
      `Questions? Contact ${club.name}.`,
    ].filter(Boolean) as string[];
    await sendEmails(
      [input.email],
      `${status === "waitlist" ? "Waitlist" : "Registered"}: ${program.title}`,
      html(confirm),
      confirm.join("\n\n")
    );

    const { data: admins } = await admin
      .from("profiles")
      .select("email")
      .eq("club_id", club.id)
      .eq("role", "admin")
      .not("approved_at", "is", null)
      .is("disabled_at", null);
    const to = ((admins as { email: string | null }[] | null) ?? []).map((a) => a.email?.trim()).filter((e): e is string => !!e);
    const what = status === "waitlist" ? "joined the waitlist for" : "registered for";
    const note = [
      `${input.participant_name}${input.profile_id ? " (a member)" : ""} ${what} ${program.title}.`,
      `Contact: ${input.guardian_name ? `${input.guardian_name}, ` : ""}${input.email}${input.phone ? `, ${input.phone}` : ""}`,
      `See everyone in the app: Admin Settings > Website > Programs.`,
    ];
    if (to.length) await sendEmails(to, `${club.name}: ${input.participant_name} ${what} ${program.title}`, html(note), note.join("\n"));
  }

  return status;
}
