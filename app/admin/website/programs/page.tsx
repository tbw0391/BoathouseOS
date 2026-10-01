import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatProgramDates, programState, type Program } from "@/lib/programs";
import { NewProgramForm } from "./NewProgramForm";

const STATE_LABEL = { draft: "Draft", not_yet: "Not open yet", open: "Taking registrations", closed: "Closed" };

// Admin Settings > Website > Programs (0117).
export default async function AdminProgramsPage() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_club_admin");
  if (!isAdmin) notFound();
  const [{ data: programRows }, { data: regRows }] = await Promise.all([
    supabase.from("programs").select("*").order("sort_order").order("starts_on", { ascending: true, nullsFirst: false }),
    supabase.from("program_registrations").select("program_id, status"),
  ]);
  const programs = (programRows as Program[] | null) ?? [];
  const regs = (regRows as { program_id: string; status: string }[] | null) ?? [];
  const count = (id: string, status: string) => regs.filter((r) => r.program_id === id && r.status === status).length;

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <Link href="/admin/website" className="text-sm text-gray-500 hover:underline">
          ← Website
        </Link>
        <h1 className="text-2xl font-bold mt-2">Programs</h1>
        <p className="text-sm text-gray-500">
          Camps, Learn to Row, seasons: anything people register for on your website. Families register without an
          account; you&apos;re emailed for each one. Card payment comes later; for now, mark people paid here.
        </p>
      </div>

      <NewProgramForm />

      {programs.length === 0 ? (
        <p className="text-sm text-gray-500">No programs yet.</p>
      ) : (
        <ul className="divide-y border rounded-lg">
          {programs.map((p) => {
            const registered = count(p.id, "registered");
            const waitlist = count(p.id, "waitlist");
            return (
              <li key={p.id}>
                <Link href={`/admin/website/programs/${p.id}`} className="px-3 py-2 flex items-center justify-between gap-3 hover:bg-gray-50">
                  <span className="min-w-0">
                    <span className="font-medium block truncate">{p.title}</span>
                    <span className="text-xs text-gray-500">
                      {[formatProgramDates(p.starts_on, p.ends_on), STATE_LABEL[programState(p)]].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-sm text-right shrink-0">
                    {registered}
                    {p.capacity !== null && ` / ${p.capacity}`} registered
                    {waitlist > 0 && <span className="block text-xs text-amber-700">{waitlist} waitlist</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
