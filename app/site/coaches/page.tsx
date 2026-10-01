import { publicPeople } from "@/lib/website";
import { StorageImage } from "@/components/StorageImage";
import { SiteShell, loadSite } from "../SiteShell";

export const dynamic = "force-dynamic";

type Person = { id: string; display_name: string; club_title: string | null; photo_url: string | null };

// Coaches and the board: names, titles and photos, never contact details.
export default async function SiteCoaches() {
  const { club, preview } = await loadSite("coaches");
  const { coaches, board } = await publicPeople(club.id);
  return (
    <SiteShell club={club} preview={preview}>
      <h1 className="text-3xl font-bold mb-6">Coaches &amp; board</h1>
      {coaches.length === 0 && board.length === 0 && <p className="text-gray-500">Coming soon.</p>}
      {coaches.length > 0 && <People title="Coaches" people={coaches} fallback="Coach" />}
      {board.length > 0 && <People title="Board" people={board} fallback="Board member" />}
    </SiteShell>
  );
}

function People({ title, people, fallback }: { title: string; people: Person[]; fallback: string }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {people.map((p) => (
          <li key={p.id} className="flex flex-col items-center text-center gap-2 border rounded-xl p-4">
            {p.photo_url ? (
              <StorageImage src={p.photo_url} alt="" width={160} height={160} className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-3xl font-semibold text-[var(--color-primary)]">
                {p.display_name.slice(0, 1)}
              </div>
            )}
            <p className="font-semibold">{p.display_name}</p>
            <p className="text-sm text-gray-500">{p.club_title ?? fallback}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
