import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emergencyInfoMissing } from "@/lib/emergencyInfo";
import {
  formatPrice,
  formatProgramDates,
  formatWhenEastern,
  parseProgramQuestions,
  programState,
  spotsLeft,
  type Program,
} from "@/lib/programs";
import type { EmergencyInfo } from "@/lib/database.types";
import { RegisterPerson } from "./RegisterPerson";

// Programs in the app (0120): members sign up their rowers (or themselves)
// with what the app already knows. New families use the club website.
export default async function ProgramsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: programRows }, { data: linkRows }, { data: me }] = await Promise.all([
    supabase.from("programs").select("*").eq("published", true).order("sort_order").order("starts_on", { ascending: true, nullsFirst: false }),
    supabase.from("family_links").select("rower_id").eq("guardian_id", user.id),
    supabase.from("profiles").select("id, display_name, role").eq("id", user.id).single(),
  ]);
  const rowerIds = ((linkRows as { rower_id: string }[] | null) ?? []).map((l) => l.rower_id);
  const familyIds = [...rowerIds, user.id];

  const [{ data: kidRows }, { data: infoRows }, { data: regRows }] = await Promise.all([
    rowerIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", rowerIds).is("disabled_at", null).order("display_name")
      : Promise.resolve({ data: [] }),
    supabase.from("emergency_info").select("*").in("profile_id", familyIds),
    supabase.from("program_registrations").select("id, program_id, profile_id, status").in("profile_id", familyIds).neq("status", "cancelled"),
  ]);
  const infoById = new Map(((infoRows as EmergencyInfo[] | null) ?? []).map((i) => [i.profile_id, i]));
  const people = [
    ...((kidRows as { id: string; display_name: string }[] | null) ?? []).map((k) => ({ id: k.id, name: k.display_name, isMe: false })),
    { id: user.id, name: (me as { display_name: string } | null)?.display_name ?? "Me", isMe: true },
  ].map((p) => ({ ...p, contactMissing: emergencyInfoMissing(infoById.get(p.id)) }));
  const regs = (regRows as { id: string; program_id: string; profile_id: string; status: string }[] | null) ?? [];

  const programs = ((programRows as Program[] | null) ?? [])
    .map((p) => ({ ...p, questions: parseProgramQuestions(p.questions), state: programState(p) }))
    .filter((p) => p.state !== "closed" || regs.some((r) => r.program_id === p.id));

  // Spots taken, counted across everyone (members only see their own rows).
  const taken = new Map<string, number>();
  if (programs.length) {
    const { data } = await createAdminClient()
      .from("program_registrations")
      .select("program_id")
      .in("program_id", programs.map((p) => p.id))
      .eq("status", "registered");
    for (const r of (data as { program_id: string }[] | null) ?? []) taken.set(r.program_id, (taken.get(r.program_id) ?? 0) + 1);
  }

  return (
    <div className="min-h-screen p-8 max-w-lg mx-auto flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold">Programs</h1>
        <p className="text-sm text-gray-500">Camps, Learn to Row and seasons. Sign up your rowers, or yourself.</p>
      </div>

      {programs.length === 0 && <p className="text-sm text-gray-500">Nothing open for sign-up right now.</p>}

      {programs.map((p) => {
        const left = spotsLeft(p.capacity, taken.get(p.id) ?? 0);
        const facts = [formatProgramDates(p.starts_on, p.ends_on), p.schedule, p.ages, formatPrice(p.price_cents)].filter(Boolean);
        const open = p.state === "open";
        return (
          <section key={p.id} className="border rounded-lg p-4 flex flex-col gap-2">
            <h2 className="font-semibold text-lg">{p.title}</h2>
            {facts.length > 0 && <p className="text-sm text-gray-600">{facts.join(" · ")}</p>}
            <p className="text-xs text-gray-500">
              {p.state === "not_yet"
                ? `Sign-up opens ${p.opens_at ? formatWhenEastern(p.opens_at) : "soon"}`
                : p.state === "closed"
                  ? "Sign-up has closed"
                  : left === null
                    ? p.closes_at
                      ? `Sign-up closes ${formatWhenEastern(p.closes_at)}`
                      : "Open for sign-up"
                    : left === 0
                      ? "Full: new sign-ups go on the waitlist"
                      : `${left} ${left === 1 ? "spot" : "spots"} left`}
            </p>
            {p.description && (
              <details className="text-sm text-gray-700">
                <summary className="cursor-pointer text-[var(--color-primary)]">Details</summary>
                <p className="whitespace-pre-line mt-1">{p.description.replace(/^#+\s*/gm, "")}</p>
              </details>
            )}
            <div className="flex flex-col gap-2 mt-1">
              {people.map((person) => (
                <RegisterPerson
                  key={person.id}
                  programId={p.id}
                  person={person}
                  questions={p.questions}
                  waiver={p.waiver}
                  registration={regs.find((r) => r.program_id === p.id && r.profile_id === person.id) ?? null}
                  open={open}
                  full={left === 0}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
