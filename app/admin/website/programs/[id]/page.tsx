import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import {
  formatPrice,
  formatWhenEastern,
  parseProgramQuestions,
  type Program,
  type ProgramRegistration,
} from "@/lib/programs";
import { saveRegistrationNote, setRegistrationPaid, setRegistrationStatus } from "../actions";
import { ProgramEditor } from "./ProgramEditor";

function age(birthdate: string | null): string | null {
  if (!birthdate) return null;
  const b = new Date(`${birthdate}T12:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) years--;
  return `age ${years}`;
}

const small = "text-xs border rounded px-2 py-1";

// One program: its settings, and everyone who registered (0117).
export default async function AdminProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_club_admin");
  if (!isAdmin) notFound();
  const [{ data: programRow }, { data: regRows }] = await Promise.all([
    supabase.from("programs").select("*").eq("id", id).maybeSingle(),
    supabase.from("program_registrations").select("*").eq("program_id", id).order("created_at"),
  ]);
  if (!programRow) notFound();
  const program = { ...(programRow as Program), questions: parseProgramQuestions((programRow as Program).questions) };
  const regs = (regRows as ProgramRegistration[] | null) ?? [];
  const groups: { title: string; status: string; rows: ProgramRegistration[] }[] = [
    { title: "Registered", status: "registered", rows: regs.filter((r) => r.status === "registered") },
    { title: "Waitlist", status: "waitlist", rows: regs.filter((r) => r.status === "waitlist") },
    { title: "Cancelled", status: "cancelled", rows: regs.filter((r) => r.status === "cancelled") },
  ];
  const paidCount = groups[0].rows.filter((r) => r.paid_at).length;
  const price = formatPrice(program.price_cents);

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href="/admin/website/programs" className="text-sm text-gray-500 hover:underline">
          ← Programs
        </Link>
        <h1 className="text-2xl font-bold mt-2">{program.title}</h1>
        {program.published && (
          <Link href={`/site/programs/${program.slug}`} className="text-sm text-[var(--color-primary)] hover:underline">
            View it on the site →
          </Link>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">
            Registrations: {groups[0].rows.length}
            {program.capacity !== null && ` of ${program.capacity}`}
            {groups[1].rows.length > 0 && `, ${groups[1].rows.length} waiting`}
          </h2>
          {regs.length > 0 && (
            <a href={`/admin/website/programs/${id}/export`} className="text-sm border rounded px-3 py-1.5">
              Download spreadsheet (CSV)
            </a>
          )}
        </div>
        {price && price !== "Free" && groups[0].rows.length > 0 && (
          <p className="text-sm text-gray-600">
            {paidCount} of {groups[0].rows.length} marked paid ({price} each).
          </p>
        )}
        {regs.length === 0 && <p className="text-sm text-gray-500">Nobody yet.</p>}
        {groups
          .filter((g) => g.rows.length > 0)
          .map((g) => (
            <div key={g.status} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-600">{g.title}</h3>
              {g.rows.map((r) => (
                <div key={r.id} className={`border rounded-lg p-3 text-sm flex flex-col gap-1 ${r.status === "cancelled" ? "opacity-60" : ""}`}>
                  <p className="font-medium">
                    {r.participant_name}
                    <span className="text-xs text-gray-500 font-normal">
                      {" "}
                      {[age(r.participant_birthdate), r.paid_at && "Paid ✓"].filter(Boolean).join(" · ")}
                    </span>
                  </p>
                  <p className="text-gray-600">
                    {r.guardian_name && `${r.guardian_name} · `}
                    <a href={`mailto:${r.email}`} className="underline">
                      {r.email}
                    </a>
                    {r.phone && (
                      <>
                        {" · "}
                        <a href={`tel:${r.phone}`} className="underline">
                          {r.phone}
                        </a>
                      </>
                    )}
                  </p>
                  {r.emergency_name && (
                    <p className="text-gray-600">
                      Emergency: {r.emergency_name}
                      {r.emergency_phone && `, ${r.emergency_phone}`}
                    </p>
                  )}
                  {r.medical_notes && <p className="text-red-800 whitespace-pre-line">Medical: {r.medical_notes}</p>}
                  {program.questions
                    .filter((q) => r.answers?.[q.id])
                    .map((q) => (
                      <p key={q.id}>
                        <span className="text-gray-500">{q.label}:</span> {r.answers[q.id]}
                      </p>
                    ))}
                  <p className="text-xs text-gray-400">
                    Signed up {formatWhenEastern(r.created_at)}
                    {r.waiver_accepted_at && " · Waiver agreed"}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {r.status !== "registered" && (
                      <ActionForm action={setRegistrationStatus}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="registered" />
                        <button type="submit" className={small}>
                          {r.status === "waitlist" ? "Give them a spot" : "Restore"}
                        </button>
                      </ActionForm>
                    )}
                    {r.status === "registered" && (
                      <ActionForm action={setRegistrationPaid}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="paid" value={r.paid_at ? "0" : "1"} />
                        <button type="submit" className={small}>
                          {r.paid_at ? "Mark unpaid" : "Mark paid"}
                        </button>
                      </ActionForm>
                    )}
                    {r.status !== "cancelled" && (
                      <ActionForm action={setRegistrationStatus}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="cancelled" />
                        <button type="submit" className={`${small} text-red-600`}>
                          Cancel
                        </button>
                      </ActionForm>
                    )}
                  </div>
                  <ActionForm action={saveRegistrationNote} className="flex gap-2 mt-1">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="notes" defaultValue={r.notes ?? ""} placeholder="Club notes (only admins see these)" className="border rounded px-2 py-1 text-xs flex-1" />
                    <button type="submit" className={small}>
                      Save
                    </button>
                  </ActionForm>
                </div>
              ))}
            </div>
          ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Program settings</h2>
        <ProgramEditor program={program} />
      </section>
    </div>
  );
}
