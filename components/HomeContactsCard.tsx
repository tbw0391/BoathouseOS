import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CONTACTS_CARD_KEY, getClubContacts } from "@/lib/contacts";
import { ContactRow } from "@/components/ContactRow";

// "Questions?" on the home page: the board's titled officers and the club
// jobs, linking to Who to Ask. Admins turn it off on Board and committees.
export async function HomeContactsCard() {
  const supabase = await createClient();
  const { data: setting } = await supabase.from("club_settings").select("value").eq("key", CONTACTS_CARD_KEY).maybeSingle();
  if ((setting as { value: string | null } | null)?.value === "off") return null;

  const { board, jobs } = await getClubContacts();
  const officers = board.filter((p) => p.title).slice(0, 3);
  const rows = [
    ...officers.map((p) => ({ key: `b-${p.id}`, person: p, role: p.title })),
    ...jobs.map((j) => ({ key: `j-${j.label}`, person: j.people[0], role: j.label })),
  ];
  if (rows.length === 0) return null;

  return (
    <div className="w-full rounded-lg border-2 border-[var(--color-primary)] px-4 py-3">
      <p className="font-semibold">Questions?</p>
      <ul className="divide-y">
        {rows.map((r) => (
          <ContactRow key={r.key} person={r.person} role={r.role} compact />
        ))}
      </ul>
      <Link href="/contacts" className="text-sm text-[var(--color-primary)] hover:underline">
        See everyone →
      </Link>
    </div>
  );
}
