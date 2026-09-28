import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ergWatts, formatErgTime, split500, weightAdjusted } from "@/lib/erg";
import { clubDateKey } from "@/lib/raceDay";
import { ErgChart } from "./ErgChart";
import { ImportConcept2, LogWorkoutForm, RemoveWorkoutButton } from "./WorkoutForms";

export const dynamic = "force-dynamic";

type Workout = {
  id: string;
  profile_id: string;
  done_on: string;
  piece: string;
  distance_m: number | null;
  time_seconds: number | null;
  stroke_rate: number | null;
  notes: string | null;
  source: string;
};

const chip = (active: boolean) =>
  `rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
    active ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white" : "border-gray-300 hover:border-[var(--color-primary)]"
  }`;

// Erg workouts: log pieces, see 2K/5K progress, import a Concept2 logbook.
// Rowers and coxswains see their own, parents their rowers', coaches and
// admins anyone's plus team rankings.
export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; view?: string; test?: string; team?: string }>;
}) {
  const { who, view, test: testParam, team } = await searchParams;
  const test = testParam === "5k" ? "5k" : "2k";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (me as { role: string } | null)?.role ?? "";
  const isManager = role === "coach" || role === "admin";

  // Who this viewer can look at.
  let people: { id: string; name: string }[] = [];
  if (isManager) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("role", ["rower", "coxswain"])
      .is("disabled_at", null)
      .not("approved_at", "is", null)
      .order("display_name");
    people = ((data as { id: string; display_name: string }[] | null) ?? []).map((p) => ({ id: p.id, name: p.display_name }));
  } else {
    const { data: links } = await supabase.from("family_links").select("rower_id").eq("guardian_id", user.id);
    const kidIds = ((links as { rower_id: string }[] | null) ?? []).map((l) => l.rower_id);
    const { data } = kidIds.length ? await supabase.from("profiles").select("id, display_name").in("id", kidIds) : { data: [] };
    const kids = ((data as { id: string; display_name: string }[] | null) ?? []).map((p) => ({ id: p.id, name: p.display_name }));
    people = role === "rower" || role === "coxswain" ? [{ id: user.id, name: "Me" }, ...kids] : kids;
  }

  if (isManager && view === "team") return <TeamView supabase={supabase} test={test} team={team ?? null} />;

  const selected = people.find((p) => p.id === who) ?? people[0] ?? null;
  const { data: rows } = selected
    ? await supabase
        .from("erg_workouts")
        .select("*")
        .eq("profile_id", selected.id)
        .order("done_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(300)
    : { data: [] };
  const workouts = (rows as Workout[] | null) ?? [];
  const tests = (distance: number) =>
    workouts
      .filter((w) => w.distance_m === distance && w.time_seconds != null)
      .map((w) => ({ date: w.done_on, seconds: Number(w.time_seconds) }))
      .reverse();

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold mt-4">Workouts</h1>
      </div>

      {isManager && (
        <div className="flex gap-2">
          <span className={chip(true)}>One rower</span>
          <Link href="/workouts?view=team" className={chip(false)}>
            Team rankings
          </Link>
        </div>
      )}

      {people.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <Link key={p.id} href={`/workouts?who=${p.id}`} className={chip(p.id === selected?.id)}>
              {p.name}
            </Link>
          ))}
        </div>
      )}

      {!selected ? (
        <p className="text-sm text-gray-600">
          {role === "parent" ? "Link your rower on your profile to see and log their workouts." : "No one to show yet."}
        </p>
      ) : (
        <>
          <LogWorkoutForm profileId={selected.id} today={clubDateKey(new Date())} />

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Progress</h2>
            <ErgChart series={{ "2K": tests(2000), "5K": tests(5000) }} />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">History</h2>
            {workouts.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-1 pr-2 font-normal">Date</th>
                      <th className="py-1 pr-2 font-normal">Piece</th>
                      <th className="py-1 pr-2 font-normal text-right">Time</th>
                      <th className="py-1 pr-2 font-normal text-right">Meters</th>
                      <th className="py-1 pr-2 font-normal text-right">/500m</th>
                      <th className="py-1 pr-2 font-normal text-right">Rate</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {workouts.map((w) => (
                      <tr key={w.id} className="border-b border-gray-100 align-top">
                        <td className="py-1 pr-2 whitespace-nowrap">
                          {new Date(`${w.done_on}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                        </td>
                        <td className="py-1 pr-2">
                          {w.piece}
                          {w.notes && <span className="block text-xs text-gray-500">{w.notes}</span>}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">{w.time_seconds != null ? formatErgTime(Number(w.time_seconds)) : "—"}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{w.distance_m?.toLocaleString() ?? "—"}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {w.distance_m && w.time_seconds ? formatErgTime(split500(w.distance_m, Number(w.time_seconds))) : "—"}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">{w.stroke_rate ?? "—"}</td>
                        <td className="py-1 text-right">
                          <RemoveWorkoutButton workoutId={w.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <ImportConcept2 profileId={selected.id} />
        </>
      )}
    </div>
  );
}

// Coaches: everyone's best 2K or 5K, fastest first, with split, watts and
// Concept2's weight-adjusted time where a weight is on file.
async function TeamView({
  supabase,
  test,
  team,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  test: "2k" | "5k";
  team: string | null;
}) {
  const distance = test === "2k" ? 2000 : 5000;
  const [{ data: rows }, { data: people }, { data: teamRows }] = await Promise.all([
    supabase.from("erg_workouts").select("profile_id, done_on, time_seconds").eq("distance_m", distance).not("time_seconds", "is", null),
    supabase
      .from("profiles")
      .select("id, display_name, weight_lbs, erg_2k_time, erg_5k_time")
      .in("role", ["rower", "coxswain"])
      .is("disabled_at", null)
      .not("approved_at", "is", null),
    supabase.from("profile_teams").select("profile_id, team"),
  ]);
  const teamOf = new Map<string, Set<string>>();
  for (const t of (teamRows as { profile_id: string; team: string }[] | null) ?? []) {
    if (!teamOf.has(t.profile_id)) teamOf.set(t.profile_id, new Set());
    teamOf.get(t.profile_id)!.add(t.team);
  }
  const best = new Map<string, { seconds: number; date: string }>();
  for (const r of (rows as { profile_id: string; done_on: string; time_seconds: number }[] | null) ?? []) {
    const s = Number(r.time_seconds);
    const cur = best.get(r.profile_id);
    if (!cur || s < cur.seconds) best.set(r.profile_id, { seconds: s, date: r.done_on });
  }
  const ranked = ((people as { id: string; display_name: string; weight_lbs: number | null }[] | null) ?? [])
    .filter((p) => !team || teamOf.get(p.id)?.has(team))
    .map((p) => ({ ...p, best: best.get(p.id) ?? null }))
    .filter((p) => p.best)
    .sort((a, b) => a.best!.seconds - b.best!.seconds);
  const teams = [...new Set([...teamOf.values()].flatMap((s) => [...s]))].filter((t) => ["mens", "womens", "development", "masters"].includes(t));
  const q = (extra: Record<string, string | null>) => {
    const params = new URLSearchParams({ view: "team", test, ...(team ? { team } : {}) });
    for (const [k, v] of Object.entries(extra)) {
      if (v == null) params.delete(k);
      else params.set(k, v);
    }
    return `/workouts?${params}`;
  };

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-4">
      <div>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold mt-4">Workouts</h1>
      </div>
      <div className="flex gap-2">
        <Link href="/workouts" className={chip(false)}>
          One rower
        </Link>
        <span className={chip(true)}>Team rankings</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["2k", "5k"] as const).map((t) => (
          <Link key={t} href={q({ test: t })} className={chip(t === test)}>
            {t.toUpperCase()}
          </Link>
        ))}
        <span className="w-2" />
        <Link href={q({ team: null })} className={chip(!team)}>
          Everyone
        </Link>
        {teams.map((t) => (
          <Link key={t} href={q({ team: t })} className={chip(team === t)}>
            {t === "mens" ? "Men" : t === "womens" ? "Women" : t[0].toUpperCase() + t.slice(1)}
          </Link>
        ))}
      </div>
      {ranked.length === 0 ? (
        <p className="text-sm text-gray-500">No {test.toUpperCase()} results logged yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-1 pr-2 font-normal">#</th>
                <th className="py-1 pr-2 font-normal">Rower</th>
                <th className="py-1 pr-2 font-normal text-right">Best</th>
                <th className="py-1 pr-2 font-normal text-right">/500m</th>
                <th className="py-1 pr-2 font-normal text-right">Watts</th>
                <th className="py-1 pr-2 font-normal text-right">Wt-adj</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p, i) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-1 pr-2 text-gray-500">{i + 1}</td>
                  <td className="py-1 pr-2">
                    <Link href={`/workouts?who=${p.id}`} className="hover:underline">
                      {p.display_name}
                    </Link>
                    <span className="block text-xs text-gray-500">
                      {new Date(`${p.best!.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                    </span>
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums font-medium">{formatErgTime(p.best!.seconds)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{formatErgTime(split500(distance, p.best!.seconds))}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{ergWatts(distance, p.best!.seconds)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {p.weight_lbs ? formatErgTime(weightAdjusted(p.best!.seconds, Number(p.weight_lbs))) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">Weight-adjusted uses Concept2&apos;s formula and the weight on each rower&apos;s profile.</p>
    </div>
  );
}
