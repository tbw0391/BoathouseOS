import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PAPERWORK, PAPERWORK_SETTINGS_KEY, paperworkStatus, parsePaperworkSettings, requiredFor, type PaperworkRecord } from "@/lib/paperwork";
import { clubDateKey } from "@/lib/raceDay";
import { PaperworkChip } from "@/components/PaperworkEditor";
import { isAdult } from "@/lib/recruiting";

export const dynamic = "force-dynamic";

// Everyone's paperwork at a glance; tap a chip to update it. ✓ = a coach
// or admin checked it.
export default async function CoachPaperworkPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (me as { role: string } | null)?.role;
  if (role !== "coach" && role !== "admin") redirect("/coach");

  const [{ data: people }, { data: rows }, { data: settingRow }, { data: coachTeamRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, role, birthday")
      .in("role", ["rower", "coxswain", "coach", "admin"])
      .is("disabled_at", null)
      .not("approved_at", "is", null)
      .order("display_name"),
    supabase.from("member_paperwork").select("profile_id, kind, completed_on, expires_on, checked_by"),
    supabase.from("club_settings").select("value").eq("key", PAPERWORK_SETTINGS_KEY).maybeSingle(),
    supabase.from("profile_teams").select("profile_id").eq("team", "coach"),
  ]);
  // SafeSport travel consent (0127) for rowers and coxes under 18.
  const { data: consentRows } = await supabase.from("transport_consents").select("rower_id, club_travel, expires_on");
  const settings = parsePaperworkSettings((settingRow as { value: string | null } | null)?.value);
  const onCoachTeam = new Set(((coachTeamRows as { profile_id: string }[] | null) ?? []).map((r) => r.profile_id));
  const today = clubDateKey(new Date());
  const byPerson = new Map<string, Map<string, PaperworkRecord>>();
  for (const r of (rows as (PaperworkRecord & { profile_id: string })[] | null) ?? []) {
    if (!byPerson.has(r.profile_id)) byPerson.set(r.profile_id, new Map());
    byPerson.get(r.profile_id)!.set(r.kind, r);
  }

  const everyone = (people as { id: string; display_name: string; role: string; birthday: string | null }[] | null) ?? [];
  const consented = new Set(
    ((consentRows as { rower_id: string; club_travel: boolean; expires_on: string }[] | null) ?? [])
      .filter((c) => c.club_travel && c.expires_on >= today)
      .map((c) => c.rower_id)
  );
  const noTravelConsent = everyone.filter(
    (p) => (p.role === "rower" || p.role === "coxswain") && !isAdult(p.birthday) && !consented.has(p.id)
  );
  const list = everyone.map((p) => {
    const needs = requiredFor(p.role, settings, onCoachTeam.has(p.id) ? ["coach"] : []);
    const records = byPerson.get(p.id) ?? new Map<string, PaperworkRecord>();
    const problems = needs.filter((n) => paperworkStatus(records.get(n.kind), today) !== "ok").length;
    return { ...p, needs, records, problems };
  }).filter((p) => p.needs.length > 0);
  const problemCount = list.filter((p) => p.problems > 0).length;
  const shown = show === "all" ? list : list.filter((p) => p.problems > 0);

  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto">
      <Link href="/coach" className="text-sm text-gray-500 hover:underline">
        ← Coach
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-1">Paperwork</h1>
      <p className="text-sm text-gray-600 mb-4">
        {PAPERWORK.map((p) => p.label).join(", ")}. Members get a reminder 30 days before something runs out. ✓
        means a coach or admin checked it.
      </p>
      <div className="flex gap-2 mb-4 text-sm">
        <Link
          href="/coach/paperwork"
          className={`rounded-lg border-2 px-3 py-1.5 font-medium ${show !== "all" ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white" : "border-gray-300"}`}
        >
          Needs attention ({problemCount})
        </Link>
        <Link
          href="/coach/paperwork?show=all"
          className={`rounded-lg border-2 px-3 py-1.5 font-medium ${show === "all" ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white" : "border-gray-300"}`}
        >
          Everyone ({list.length})
        </Link>
      </div>
      {shown.length === 0 && <p className="text-sm text-green-700">Everyone&apos;s paperwork is up to date.</p>}
      <div className="flex flex-col gap-2">
        {shown.map((p) => (
          <div key={p.id} className="rounded-lg border-2 border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <Link href={`/roster/${p.id}`} className="font-semibold hover:underline">
                {p.display_name}
              </Link>
              <span className="text-xs text-gray-500 capitalize">{p.role}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.needs.map((n) => (
                <PaperworkChip
                  key={n.kind}
                  profileId={p.id}
                  kind={n.kind}
                  label={n.short}
                  record={p.records.get(n.kind) ?? null}
                  todayKey={today}
                  showLabel
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mt-8">Travel consent</h2>
      <p className="text-sm text-gray-600 mb-2">
        SafeSport: rowers under 18 need a parent&apos;s yearly consent before riding in club-arranged travel. Parents
        give it on the rower&apos;s profile.
      </p>
      {noTravelConsent.length === 0 ? (
        <p className="text-sm text-green-700">Every rower under 18 has travel consent.</p>
      ) : (
        <p className="text-sm">
          Still needed ({noTravelConsent.length}):{" "}
          {noTravelConsent.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ", "}
              <Link href={`/roster/${p.id}`} className="underline">
                {p.display_name}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
