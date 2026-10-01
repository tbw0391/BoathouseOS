import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClubContacts } from "@/lib/contacts";
import { ContactRow } from "@/components/ContactRow";

// Who to ask: the board, club jobs, committees and coaches (0109). Admins
// set titles and committees on Admin Settings > Board and committees.
export default async function ContactsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: isAdmin } = user ? await supabase.rpc("is_club_admin") : { data: false };
  const { board, jobs, committees, coaches } = await getClubContacts();
  const empty = board.length + jobs.length + committees.length + coaches.length === 0;

  return (
    <div className="min-h-screen p-8 max-w-lg mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Who to Ask</h1>
        <p className="text-sm text-gray-500">The board, who runs what, and the coaches.</p>
        {isAdmin && (
          <Link href="/admin/contacts" className="text-sm text-[var(--color-primary)] hover:underline">
            Edit board, titles and committees →
          </Link>
        )}
      </div>

      {empty && <p className="text-sm text-gray-500">Nobody&apos;s listed yet.</p>}

      {board.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Board</h2>
          <ul className="divide-y">
            {board.map((p) => (
              <ContactRow key={p.id} person={p} role={p.title ?? "Board member"} />
            ))}
          </ul>
        </section>
      )}

      {jobs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Club jobs</h2>
          <ul className="divide-y">
            {jobs.flatMap((j) => j.people.map((p) => <ContactRow key={`${j.label}-${p.id}`} person={p} role={j.label} />))}
          </ul>
        </section>
      )}

      {committees.map((c) => (
        <section key={c.id}>
          <h2 className="text-lg font-semibold">{c.name}</h2>
          {c.members.length === 0 ? (
            <p className="text-sm text-gray-500">No one yet.</p>
          ) : (
            <ul className="divide-y">
              {c.members.map((p) => (
                <ContactRow key={p.id} person={p} role={p.is_chair ? "Chair" : null} />
              ))}
            </ul>
          )}
        </section>
      ))}

      {coaches.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Coaches</h2>
          <ul className="divide-y">
            {coaches.map((p) => (
              <ContactRow key={p.id} person={p} role={p.title ?? "Coach"} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
