import { recentResults } from "@/lib/website";
import { ordinalPlace, placeEmoji } from "@/lib/raceResults";
import { SiteShell, loadSite, when } from "../SiteShell";

export const dynamic = "force-dynamic";

// Places by boat at recent regattas, never who rowed.
export default async function SiteResults() {
  const { club, preview, member } = await loadSite("results");
  const results = await recentResults(club.id, 10);
  return (
    <SiteShell club={club} preview={preview} member={member}>
      <h1 className="text-3xl font-bold mb-6">Results</h1>
      {results.length === 0 ? (
        <p className="text-gray-500">No results posted yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {results.map((r) => (
            <section key={r.id} className="border rounded-xl p-4">
              <h2 className="text-lg font-semibold">{r.title}</h2>
              <p className="text-sm text-gray-500 mb-2">{when(r.starts_at)}</p>
              <ul className="flex flex-col gap-1">
                {r.races.map((x, i) => (
                  <li key={i}>
                    {placeEmoji(x.place)} <span className="font-medium">{ordinalPlace(x.place)}</span> · {x.race}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </SiteShell>
  );
}
