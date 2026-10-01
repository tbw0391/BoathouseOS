import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Form } from "@/lib/database.types";
import { audienceLabel, canCreateElections, canCreateForms, formIsOpen, formatClosing } from "@/lib/forms";

// Forms, surveys and elections (0115). Everyone sees the ones meant for
// them; admins, coaches and board members make forms, and admins and board
// members run elections.
export default async function FormsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: me }, { data: formRows }, { data: myResponses }, { data: myVotes }] = await Promise.all([
    supabase.from("profiles").select("role, is_board_member").eq("id", user.id).single(),
    supabase.from("forms").select("*").order("created_at", { ascending: false }),
    supabase.from("form_responses").select("form_id").eq("respondent_id", user.id),
    supabase.from("election_voters").select("form_id").eq("voter_id", user.id),
  ]);
  const profile = me as { role: string; is_board_member: boolean } | null;
  const forms = (formRows as Form[] | null) ?? [];
  const done = new Set(
    [...((myResponses as { form_id: string }[] | null) ?? []), ...((myVotes as { form_id: string }[] | null) ?? [])].map(
      (r) => r.form_id
    )
  );
  const open = forms.filter((f) => formIsOpen(f));
  const closed = forms.filter((f) => !formIsOpen(f));

  const row = (f: Form) => (
    <li key={f.id}>
      <Link href={`/forms/${f.id}`} className="flex items-center gap-3 py-3 hover:bg-gray-50">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            {f.kind === "election" && (
              <span className="text-xs font-semibold uppercase text-[var(--color-primary)] mr-2">Election</span>
            )}
            {f.title}
          </p>
          <p className="text-xs text-gray-500">
            {audienceLabel(f.audience)}
            {formIsOpen(f) && f.closes_at && ` · Closes ${formatClosing(f.closes_at)}`}
            {!formIsOpen(f) && " · Closed"}
          </p>
        </div>
        {done.has(f.id) ? (
          <span className="text-xs text-green-700">{f.kind === "election" ? "Voted ✓" : "Done ✓"}</span>
        ) : (
          formIsOpen(f) && <span className="text-xs text-[var(--color-primary)]">{f.kind === "election" ? "Vote" : "Fill in"} →</span>
        )}
      </Link>
    </li>
  );

  return (
    <div className="min-h-screen p-8 max-w-lg mx-auto flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold">Forms &amp; Elections</h1>
        <p className="text-sm text-gray-500">Sign-ups, surveys and board elections.</p>
      </div>

      {(canCreateForms(profile) || canCreateElections(profile)) && (
        <div className="flex flex-wrap gap-2">
          {canCreateForms(profile) && (
            <Link
              href="/forms/new"
              className="text-sm bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2"
            >
              New form
            </Link>
          )}
          {canCreateElections(profile) && (
            <Link href="/forms/new?kind=election" className="text-sm border-2 border-[var(--color-primary)] rounded px-3 py-2">
              New election
            </Link>
          )}
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold">Open</h2>
        {open.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing open right now.</p>
        ) : (
          <ul className="divide-y">{open.map(row)}</ul>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Closed</h2>
          <ul className="divide-y">{closed.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
