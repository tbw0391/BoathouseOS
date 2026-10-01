import { upcomingRegattas } from "@/lib/website";
import { SiteShell, loadSite, when } from "../SiteShell";

export const dynamic = "force-dynamic";

// Upcoming regattas only: practice times and places stay private.
export default async function SiteSchedule() {
  const { club, preview } = await loadSite("schedule");
  const regattas = await upcomingRegattas(club.id);
  return (
    <SiteShell club={club} preview={preview}>
      <h1 className="text-3xl font-bold mb-6">Schedule</h1>
      {regattas.length === 0 ? (
        <p className="text-gray-500">No regattas on the schedule right now.</p>
      ) : (
        <ul className="divide-y border rounded-xl">
          {regattas.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <p className="font-semibold">{r.title}</p>
              <p className="text-sm text-gray-500">
                {when(r.starts_at, r.ends_at)}
                {r.location && ` · ${r.location}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SiteShell>
  );
}
