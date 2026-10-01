import Link from "next/link";
import { publicPrograms } from "@/lib/website";
import { formatPrice, formatProgramDates, programState, spotsLeft } from "@/lib/programs";
import { SiteShell, loadSite } from "../SiteShell";

export const dynamic = "force-dynamic";

// Camps, Learn to Row and seasons people can register for (0117).
export default async function SitePrograms() {
  const { club, preview, member } = await loadSite("programs");
  const programs = await publicPrograms(club.id);
  return (
    <SiteShell club={club} preview={preview} member={member}>
      <h1 className="text-3xl font-bold mb-6">Programs</h1>
      {programs.length === 0 ? (
        <p className="text-gray-500">Nothing open for registration right now. Check back soon.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => {
            const state = programState(p);
            const left = spotsLeft(p.capacity, p.registered);
            const facts = [formatProgramDates(p.starts_on, p.ends_on), p.ages, formatPrice(p.price_cents)].filter(Boolean);
            return (
              <li key={p.id}>
                <Link href={`/site/programs/${p.slug}`} className="block border rounded-xl p-4 h-full hover:border-[var(--color-primary)]">
                  <p className="font-semibold text-lg">{p.title}</p>
                  {facts.length > 0 && <p className="text-sm text-gray-600">{facts.join(" · ")}</p>}
                  {p.schedule && <p className="text-sm text-gray-500">{p.schedule}</p>}
                  <p className="text-sm font-medium mt-2 text-[var(--color-primary)]">
                    {state === "not_yet"
                      ? "Registration opens soon"
                      : state === "closed"
                        ? "Registration closed"
                        : left === 0
                          ? "Full: join the waitlist →"
                          : `Register →${left !== null && left <= 5 ? ` (${left} ${left === 1 ? "spot" : "spots"} left)` : ""}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SiteShell>
  );
}
