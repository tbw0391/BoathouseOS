import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseThemeColors, THEME_COLOR_LABELS, type ThemeColorKey } from "@/lib/theme";

type Person = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  approved_at: string | null;
  disabled_at: string | null;
};
type EventRow = { id: string; title: string; starts_at: string; event_type: string; location: string | null };

// Looking inside one club, read-only, with the service role: global admins
// are walled into their own club in the app itself, so this is how they see
// the others.
export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: isGlobalAdmin } = await supabase.rpc("is_global_admin");
  if (!isGlobalAdmin) notFound();

  const admin = createAdminClient();
  const { data: clubRow } = await admin.from("clubs").select("id, name, slug, created_at").eq("id", id).maybeSingle();
  const club = clubRow as { id: string; name: string; slug: string; created_at: string } | null;
  if (!club) notFound();

  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const count = async (table: string, since?: string) => {
    let q = admin.from(table).select("*", { count: "exact", head: true }).eq("club_id", id);
    if (since) q = q.gte("created_at", since);
    return (await q).count ?? 0;
  };

  const [
    { data: peopleData },
    { data: eventData },
    { data: boatData },
    { data: themeRow },
    lineups,
    races,
    messages,
    photos,
    polls,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, email, phone, role, approved_at, disabled_at")
      .eq("club_id", id)
      .order("display_name"),
    admin
      .from("schedule_events")
      .select("id, title, starts_at, event_type, location")
      .eq("club_id", id)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(10),
    admin.from("boats").select("name").eq("club_id", id).order("name"),
    admin.from("club_settings").select("value").eq("club_id", id).eq("key", "theme_colors").maybeSingle(),
    count("lineups"),
    count("races"),
    count("messages", monthAgo),
    count("photos"),
    count("polls"),
  ]);
  const people = (peopleData as Person[] | null) ?? [];
  const active = people.filter((p) => p.approved_at && !p.disabled_at);
  const waiting = people.filter((p) => !p.approved_at);
  const removed = people.filter((p) => p.approved_at && p.disabled_at);
  const events = (eventData as EventRow[] | null) ?? [];
  const boats = ((boatData as { name: string }[] | null) ?? []).map((b) => b.name);
  const theme = parseThemeColors((themeRow as { value: string | null } | null)?.value);

  const roleCounts = active.reduce<Record<string, number>>((acc, p) => {
    acc[p.role] = (acc[p.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen p-8 flex flex-col gap-6 max-w-2xl">
      <div>
        <Link href="/global-admin/clubs" className="text-sm text-gray-500 hover:underline">
          ← Clubs
        </Link>
        <h1 className="text-2xl font-bold">{club.name}</h1>
        <p className="text-sm text-gray-500">
          {club.slug} · since {new Date(club.created_at).toLocaleDateString()} · view only
        </p>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        {[
          ["Members", active.length],
          ["Waiting", waiting.length],
          ["Lineups", lineups],
          ["Races", races],
          ["Messages (30 days)", messages],
          ["Photos", photos],
          ["Polls", polls],
          ["Boats", boats.length],
        ].map(([label, n]) => (
          <div key={label} className="border rounded-lg p-3">
            <p className="text-xl font-semibold">{n}</p>
            <p className="text-gray-500">{label}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1">Colors</h2>
        <div className="flex flex-wrap gap-3 text-xs">
          {(Object.keys(THEME_COLOR_LABELS) as ThemeColorKey[]).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block w-5 h-5 rounded border" style={{ background: theme[k] }} />
              {THEME_COLOR_LABELS[k]}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1">
          Members ({active.length})
          {Object.keys(roleCounts).length > 0 && (
            <span className="text-sm font-normal text-gray-500">
              {" "}
              · {Object.entries(roleCounts).map(([r, n]) => `${n} ${r}`).join(", ")}
            </span>
          )}
        </h2>
        <PeopleList people={active} />
        {waiting.length > 0 && (
          <>
            <h3 className="font-medium mt-3 mb-1">Waiting for approval ({waiting.length})</h3>
            <PeopleList people={waiting} />
          </>
        )}
        {removed.length > 0 && (
          <>
            <h3 className="font-medium mt-3 mb-1">Removed from roster ({removed.length})</h3>
            <PeopleList people={removed} />
          </>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1">Coming up</h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing on the schedule.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {events.map((e) => (
              <li key={e.id} className="border rounded px-3 py-2">
                <span className="font-medium">{e.title}</span>
                <span className="text-gray-500">
                  {" "}
                  · {new Date(e.starts_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })}
                  {e.location && ` · ${e.location}`}
                  {` · ${e.event_type}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1">Boats</h2>
        <p className="text-sm text-gray-600">{boats.length ? boats.join(", ") : "None yet."}</p>
      </section>
    </div>
  );
}

function PeopleList({ people }: { people: Person[] }) {
  if (people.length === 0) return <p className="text-sm text-gray-500">No one.</p>;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {people.map((p) => (
        <li key={p.id} className="border rounded px-3 py-2 flex flex-wrap justify-between gap-x-3">
          <span>
            {p.display_name} <span className="text-gray-500">· {p.role}</span>
          </span>
          <span className="text-gray-500 break-all">{[p.email, p.phone].filter(Boolean).join(" · ")}</span>
        </li>
      ))}
    </ul>
  );
}
