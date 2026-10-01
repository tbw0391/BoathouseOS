import { createClient } from "@/lib/supabase/server";
import { parseProgramQuestions, type Program, type ProgramRegistration } from "@/lib/programs";

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// A program's registrations as a spreadsheet, for admins (0117).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_club_admin");
  if (!isAdmin) return new Response("Not allowed.", { status: 403 });

  const [{ data: programRow }, { data: regRows }] = await Promise.all([
    supabase.from("programs").select("*").eq("id", id).maybeSingle(),
    supabase.from("program_registrations").select("*").eq("program_id", id).order("created_at"),
  ]);
  const program = programRow as Program | null;
  if (!program) return new Response("Not found.", { status: 404 });
  const questions = parseProgramQuestions(program.questions);
  const regs = (regRows as ProgramRegistration[] | null) ?? [];

  const header = [
    "Status",
    "Participant",
    "Birth date",
    "Parent/guardian",
    "Email",
    "Phone",
    "Emergency contact",
    "Emergency phone",
    "Medical notes",
    ...questions.map((q) => q.label),
    "Waiver agreed",
    "Paid",
    "Club notes",
    "Signed up",
  ];
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York" }) : "");
  const lines = [
    header.map(csvCell).join(","),
    ...regs.map((r) =>
      [
        r.status,
        r.participant_name,
        r.participant_birthdate,
        r.guardian_name,
        r.email,
        r.phone,
        r.emergency_name,
        r.emergency_phone,
        r.medical_notes,
        ...questions.map((q) => r.answers?.[q.id] ?? ""),
        when(r.waiver_accepted_at),
        when(r.paid_at),
        r.notes,
        when(r.created_at),
      ]
        .map(csvCell)
        .join(",")
    ),
  ];
  const filename = `${program.slug || "program"}-registrations.csv`;
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
