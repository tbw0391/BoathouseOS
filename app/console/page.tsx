import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { saveDemoBaseline, resetDemo } from "./actions";
import { ActionForm } from "@/components/ActionForm";
import { IS_DEMO_SITE } from "@/lib/site";
import { allAuthUsers, consoleUser, daysAgo, formatWhen } from "@/lib/console";
import { Card, ConsolePage, NotGlobalAdmin, Stat, buttonClass } from "./ui";

type InterestSignup = {
  id: string;
  name: string | null;
  club_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

// The console's front page: how things stand across every club.
export default async function ConsoleHome() {
  const me = await consoleUser();
  if (!me) return <NotGlobalAdmin />;

  const admin = createAdminClient();
  const supabase = await createClient();
  const [{ data: clubData }, { data: peopleData }, { data: errorData }, { data: interestData }, users, baseline] =
    await Promise.all([
      admin.from("clubs").select("id, name, slug, suspended_at").order("name"),
      admin.from("profiles").select("id, club_id, approved_at, disabled_at"),
      admin.from("error_reports").select("id, message, count, last_seen").is("resolved_at", null).order("last_seen", { ascending: false }),
      admin
        .from("interest_signups")
        .select("id, name, club_name, email, phone, created_at")
        .order("created_at", { ascending: false }),
      allAuthUsers(admin),
      IS_DEMO_SITE ? supabase.rpc("demo_baseline_saved_at") : Promise.resolve({ data: null }),
    ]);
  const { count: newSuggestions } = await admin
    .from("suggestions")
    .select("id", { count: "exact", head: true })
    .eq("category", "app")
    .neq("status", "reviewed");
  const clubs = (clubData as { id: string; name: string; slug: string; suspended_at: string | null }[] | null) ?? [];
  const people =
    (peopleData as { id: string; club_id: string; approved_at: string | null; disabled_at: string | null }[] | null) ?? [];
  const errors = (errorData as { id: string; message: string; count: number; last_seen: string }[] | null) ?? [];
  const interest = (interestData as InterestSignup[] | null) ?? [];

  const active = people.filter((p) => p.approved_at && !p.disabled_at);
  const waiting = people.filter((p) => !p.approved_at && !p.disabled_at);
  const memberIds = new Set(active.map((p) => p.id));
  const weekAgo = daysAgo(7);
  const signedInThisWeek = users.filter((u) => memberIds.has(u.id) && u.last_sign_in_at && u.last_sign_in_at > weekAgo);
  const suspended = clubs.filter((c) => c.suspended_at);
  const waitingByClub = clubs
    .map((c) => ({ club: c, n: waiting.filter((p) => p.club_id === c.id).length }))
    .filter((x) => x.n > 0);

  return (
    <ConsolePage title="Overview" subtitle={`Signed in as ${me.email ?? "global admin"}`}>
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        <Stat label={suspended.length ? `Clubs (${suspended.length} suspended)` : "Clubs"} value={clubs.length} href="/console/clubs" />
        <Stat label="Members" value={active.length} href="/console/members" />
        <Stat label="Signed in this week" value={signedInThisWeek.length} href="/console/health" />
        <Stat label="Waiting for approval" value={waiting.length} href="/console/members?status=waiting" />
        <Stat label="Open errors" value={errors.length} href="/console/errors" />
        <Stat label="Interested clubs" value={interest.length} />
        <Stat label="New app suggestions" value={newSuggestions ?? 0} href="/console/suggestions" />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Needs attention">
          {errors.length === 0 && waitingByClub.length === 0 && suspended.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing right now.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {errors.slice(0, 5).map((e) => (
                <li key={e.id}>
                  <Link href="/console/errors" className="text-red-700 hover:underline">
                    Error: {e.message.slice(0, 90)}
                  </Link>
                  <span className="text-gray-500">
                    {" "}
                    · {e.count}× · last {formatWhen(e.last_seen)}
                  </span>
                </li>
              ))}
              {waitingByClub.map(({ club, n }) => (
                <li key={club.id}>
                  <Link href={`/console/members?club=${club.id}&status=waiting`} className="hover:underline">
                    {club.name}: {n} waiting for approval
                  </Link>
                </li>
              ))}
              {suspended.map((c) => (
                <li key={c.id}>
                  <Link href={`/console/clubs/${c.id}`} className="hover:underline">
                    {c.name} is suspended
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Interested clubs (${interest.length})`}>
          {interest.length === 0 ? (
            <p className="text-sm text-gray-500">No one yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {interest.map((s) => (
                <li key={s.id} className="border rounded-lg px-3 py-2 text-sm">
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
                  <p className="text-xs text-gray-400">{formatWhen(s.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {IS_DEMO_SITE && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Demo: set a new default">
            <p className="text-sm text-gray-500">
              Saves everything as it is right now (settings, members, schedule, lineups, messages) as the default
              the demo resets back to. Replaces the previous default.
            </p>
            <p className="text-xs text-gray-500">
              Current default saved: {baseline.data ? formatWhen(baseline.data as string) : "never"}
            </p>
            <form action={saveDemoBaseline}>
              <button type="submit" className={buttonClass}>
                Set current data as new default
              </button>
            </form>
            <Link href="/console/qr" className="text-sm text-[var(--color-primary)] hover:underline">
              QR codes to print or show →
            </Link>
          </Card>

          <Card title="Demo: reset to default" tone="danger">
            <p className="text-sm text-gray-500">
              Undoes every change people have made since the default was saved, and deletes accounts created
              since. Interested-club signups are kept.
            </p>
            <ActionForm action={resetDemo} className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="confirm" required />
                I want to undo everyone&apos;s changes
              </label>
              <button
                type="submit"
                disabled={!baseline.data}
                className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Reset to default
              </button>
              {!baseline.data && <p className="text-xs text-gray-500">Set a default first.</p>}
            </ActionForm>
          </Card>
        </div>
      )}
    </ConsolePage>
  );
}
