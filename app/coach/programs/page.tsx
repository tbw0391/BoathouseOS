import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatProgramDates, parseProgramQuestions, type Program, type ProgramRegistration } from "@/lib/programs";

function age(birthdate: string | null): string | null {
  if (!birthdate) return null;
  const b = new Date(`${birthdate}T12:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) years--;
  return `age ${years}`;
}

// Coach > Program Sign-ups: who's coming to each camp or Learn to Row
// session, with tap-to-call contacts and medical notes (0117). Read-only;
// admins manage registrations under Admin Settings > Website > Programs.
export default async function CoachProgramsPage() {
  const supabase = await createClient();
  const { data: canView } = await supabase.rpc("is_coach_or_admin");
  if (!canView) {
    return (
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-6">Program Sign-ups</h1>
        <p className="text-sm text-gray-500">Only coaches and admins can view this section.</p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: programRows }, { data: regRows }] = await Promise.all([
    supabase.from("programs").select("*").order("starts_on", { ascending: true, nullsFirst: false }),
    supabase.from("program_registrations").select("*").neq("status", "cancelled").order("participant_name"),
  ]);
  const regs = (regRows as ProgramRegistration[] | null) ?? [];
  // Running now or coming up, plus anything undated that has sign-ups.
  const programs = ((programRows as Program[] | null) ?? [])
    .map((p) => ({ ...p, questions: parseProgramQuestions(p.questions) }))
    .filter((p) => (p.ends_on ?? p.starts_on ?? today) >= today)
    .filter((p) => p.published || regs.some((r) => r.program_id === p.id));

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <Link href="/coach" className="text-sm text-gray-500 hover:underline">
          ← Coach
        </Link>
        <h1 className="text-2xl font-bold">Program Sign-ups</h1>
        <p className="text-sm text-gray-500">Camps and programs families signed up for on the club website.</p>
      </div>

      {programs.length === 0 && <p className="text-sm text-gray-500">No programs running or coming up.</p>}

      {programs.map((p, i) => {
        const registered = regs.filter((r) => r.program_id === p.id && r.status === "registered");
        const waitlist = regs.filter((r) => r.program_id === p.id && r.status === "waitlist");
        const medical = registered.filter((r) => r.medical_notes).length;
        return (
          <details key={p.id} open={i === 0} className="border rounded-lg">
            <summary className="cursor-pointer px-4 py-3">
              <span className="font-semibold">{p.title}</span>
              <span className="block text-xs text-gray-500">
                {[
                  formatProgramDates(p.starts_on, p.ends_on),
                  p.schedule,
                  `${registered.length} coming`,
                  waitlist.length > 0 && `${waitlist.length} waitlist`,
                  medical > 0 && `${medical} with medical notes`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </summary>
            {registered.length === 0 ? (
              <p className="px-4 pb-3 text-sm text-gray-500">Nobody yet.</p>
            ) : (
              <ul className="divide-y border-t">
                {registered.map((r) => (
                  <li key={r.id} className="px-4 py-3 text-sm flex flex-col gap-0.5">
                    <p className="font-medium">
                      {r.profile_id ? (
                        <Link href={`/roster/${r.profile_id}`} className="hover:underline">
                          {r.participant_name}
                        </Link>
                      ) : (
                        r.participant_name
                      )}
                      {age(r.participant_birthdate) && <span className="text-xs text-gray-500 font-normal"> · {age(r.participant_birthdate)}</span>}
                    </p>
                    {r.medical_notes && <p className="text-red-800 whitespace-pre-line">⚠ {r.medical_notes}</p>}
                    <p className="text-gray-600">
                      {r.guardian_name ?? "Parent"}:{" "}
                      {r.phone ? (
                        <a href={`tel:${r.phone}`} className="underline">
                          {r.phone}
                        </a>
                      ) : (
                        r.email
                      )}
                    </p>
                    {r.emergency_name && (
                      <p className="text-gray-600">
                        Emergency: {r.emergency_name}
                        {r.emergency_phone && (
                          <>
                            {" "}
                            <a href={`tel:${r.emergency_phone}`} className="underline">
                              {r.emergency_phone}
                            </a>
                          </>
                        )}
                      </p>
                    )}
                    {p.questions
                      .filter((q) => r.answers?.[q.id])
                      .map((q) => (
                        <p key={q.id} className="text-gray-600">
                          {q.label}: {r.answers[q.id]}
                        </p>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </details>
        );
      })}
    </div>
  );
}
