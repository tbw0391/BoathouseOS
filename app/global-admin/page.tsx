import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveDemoBaseline, resetDemo } from "./actions";

type InterestSignup = {
  id: string;
  name: string | null;
  club_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export default async function GlobalAdminPage() {
  const supabase = await createClient();
  const { data: isGlobalAdmin } = await supabase.rpc("is_global_admin");
  if (!isGlobalAdmin) notFound();

  const [{ data: baselineSavedAt }, { data: interestData }] = await Promise.all([
    supabase.rpc("demo_baseline_saved_at"),
    supabase
      .from("interest_signups")
      .select("id, name, club_name, email, phone, created_at")
      .order("created_at", { ascending: false }),
  ]);
  const interestSignups = (interestData as InterestSignup[] | null) ?? [];

  return (
    <div className="min-h-screen p-8 flex flex-col gap-8 max-w-md">
      <h1 className="text-2xl font-bold">Global Admin</h1>

      <section className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-1">Set a new default</h2>
        <p className="text-sm text-gray-500 mb-3">
          Saves everything as it is right now (settings, members, schedule, lineups, messages) as
          the default the demo resets back to. Replaces the previous default.
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Current default saved:{" "}
          {baselineSavedAt ? new Date(baselineSavedAt as string).toLocaleString() : "never"}
        </p>
        <form action={saveDemoBaseline}>
          <button
            type="submit"
            className="w-full bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--color-accent)]"
          >
            Set current data as new default
          </button>
        </form>
      </section>

      <section className="border-2 border-red-300 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-1">Reset to default</h2>
        <p className="text-sm text-gray-500 mb-3">
          Undoes every change people have made since the default was saved, and deletes accounts
          created since. Interested-club signups are kept.
        </p>
        <form action={resetDemo} className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" required />
            I want to undo everyone&apos;s changes
          </label>
          <button
            type="submit"
            disabled={!baselineSavedAt}
            className="bg-red-600 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            Reset to default
          </button>
          {!baselineSavedAt && (
            <p className="text-xs text-gray-500">Set a default first.</p>
          )}
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Interested clubs ({interestSignups.length})</h2>
        {interestSignups.length === 0 ? (
          <p className="text-sm text-gray-500">No one yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {interestSignups.map((s) => (
              <li key={s.id} className="border rounded-lg px-4 py-3 text-sm">
                <p className="font-medium">
                  {s.name ?? "No name"}
                  {s.club_name && <span className="text-gray-500 font-normal"> · {s.club_name}</span>}
                </p>
                {s.email && (
                  <a href={`mailto:${s.email}`} className="block text-[var(--color-primary)] hover:underline">
                    {s.email}
                  </a>
                )}
                {s.phone && (
                  <a href={`tel:${s.phone}`} className="block text-[var(--color-primary)] hover:underline">
                    {s.phone}
                  </a>
                )}
                <p className="text-xs text-gray-400">{new Date(s.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
