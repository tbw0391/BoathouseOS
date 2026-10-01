import Link from "next/link";
import { newsPosts, recentResults, upcomingRegattas } from "@/lib/website";
import { ordinalPlace, placeEmoji } from "@/lib/raceResults";
import { SiteShell, loadSite, when } from "./SiteShell";
import { SiteText } from "./SiteText";

export const dynamic = "force-dynamic";

// The club website's front page (0112).
export default async function SiteHome() {
  const { club, preview } = await loadSite();
  const s = club.settings;
  const [regattas, results, news] = await Promise.all([
    s.sections.schedule ? upcomingRegattas(club.id, 3) : Promise.resolve([]),
    s.sections.results ? recentResults(club.id, 2) : Promise.resolve([]),
    s.sections.news ? newsPosts(club.id, 3) : Promise.resolve([]),
  ]);

  return (
    <SiteShell club={club} preview={preview}>
      <section
        className="relative rounded-2xl overflow-hidden mb-8 bg-[var(--color-primary)] text-white"
        style={club.heroUrl ? { backgroundImage: `url(${club.heroUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        <div className={`px-6 py-16 sm:py-24 ${club.heroUrl ? "bg-black/40" : ""}`}>
          <h1 className="text-3xl sm:text-5xl font-bold">{club.name}</h1>
          {s.tagline && <p className="mt-3 text-lg sm:text-xl max-w-2xl">{s.tagline}</p>}
          {s.sections.join && (
            <Link href="/site/join" className="inline-block mt-6 rounded-lg bg-white text-[var(--color-primary)] px-5 py-2.5 font-semibold">
              Join us
            </Link>
          )}
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2 flex flex-col gap-8">
          {s.about && (
            <section>
              <h2 className="text-2xl font-bold mb-3">About us</h2>
              <SiteText text={s.about} />
            </section>
          )}
          {news.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-3">News</h2>
              <ul className="flex flex-col gap-4">
                {news.map((n) => (
                  <li key={n.slug}>
                    <Link href={`/site/p/${n.slug}`} className="text-lg font-semibold hover:underline">
                      {n.title}
                    </Link>
                    <p className="text-xs text-gray-500">{when(n.created_at)}</p>
                    <p className="text-gray-700 line-clamp-2">{n.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          {regattas.length > 0 && (
            <section className="rounded-xl border p-4">
              <h2 className="font-bold mb-2">Coming up</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {regattas.map((r) => (
                  <li key={r.id}>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-gray-500">
                      {when(r.starts_at, r.ends_at)}
                      {r.location && ` · ${r.location}`}
                    </p>
                  </li>
                ))}
              </ul>
              <Link href="/site/schedule" className="text-sm text-[var(--color-primary)] hover:underline">
                Full schedule →
              </Link>
            </section>
          )}
          {results.length > 0 && (
            <section className="rounded-xl border p-4">
              <h2 className="font-bold mb-2">Recent results</h2>
              {results.map((r) => (
                <div key={r.id} className="mb-2 text-sm">
                  <p className="font-medium">{r.title}</p>
                  <ul className="text-gray-700">
                    {r.races.slice(0, 5).map((x, i) => (
                      <li key={i}>
                        {placeEmoji(x.place)} {ordinalPlace(x.place)} · {x.race}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <Link href="/site/results" className="text-sm text-[var(--color-primary)] hover:underline">
                All results →
              </Link>
            </section>
          )}
        </aside>
      </div>
    </SiteShell>
  );
}
