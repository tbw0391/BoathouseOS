import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CreateClubForm } from "./CreateClubForm";
import { NewPasswordButton } from "./NewPasswordButton";
import { SELF_SIGNUP_OPEN } from "@/lib/signup";

type ClubRow = { id: string; name: string; slug: string; join_code: string; created_at: string };
type Person = {
  id: string;
  club_id: string;
  display_name: string;
  email: string | null;
  role: string;
  approved_at: string | null;
  disabled_at: string | null;
};

// Every club, read with the service role (members, global admins included,
// only ever see their own club through the database).
export default async function ClubsPage() {
  const supabase = await createClient();
  const { data: isGlobalAdmin } = await supabase.rpc("is_global_admin");
  if (!isGlobalAdmin) notFound();

  const admin = createAdminClient();
  const [{ data: clubData }, { data: peopleData }] = await Promise.all([
    admin.from("clubs").select("id, name, slug, join_code, created_at").order("created_at"),
    admin.from("profiles").select("id, club_id, display_name, email, role, approved_at, disabled_at"),
  ]);
  const clubs = (clubData as ClubRow[] | null) ?? [];
  const people = (peopleData as Person[] | null) ?? [];

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.boathouseos.app";
  const origin = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  return (
    <div className="min-h-screen p-8 flex flex-col gap-8 max-w-2xl">
      <div>
        <Link href="/global-admin" className="text-sm text-gray-500 hover:underline">
          ← Global Admin
        </Link>
        <h1 className="text-2xl font-bold">Clubs</h1>
      </div>

      <CreateClubForm />

      <ul className="flex flex-col gap-4">
        {clubs.map((club) => {
          const members = people.filter((p) => p.club_id === club.id);
          const active = members.filter((p) => p.approved_at && !p.disabled_at);
          const waiting = members.filter((p) => !p.approved_at);
          const admins = active.filter((p) => p.role === "admin");
          const joinLink = `${origin}/signup?join=${club.join_code}`;
          return (
            <li key={club.id} className="border rounded-lg p-4 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{club.name}</h2>
                  <span className="text-xs text-gray-500">{club.slug}</span>
                </div>
                <Link
                  href={`/global-admin/clubs/${club.id}`}
                  className="shrink-0 border-2 border-[var(--color-primary)] rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
                >
                  View
                </Link>
              </div>
              <p className="text-gray-600">
                {active.length} member{active.length === 1 ? "" : "s"}
                {waiting.length > 0 && ` · ${waiting.length} waiting for approval`}
                {" · "}since {new Date(club.created_at).toLocaleDateString()}
              </p>
              <div>
                <p className="font-medium">Admins</p>
                {admins.length === 0 ? (
                  <p className="text-gray-500">None</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {admins.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {a.display_name}
                          {a.email && <span className="text-gray-500"> · {a.email}</span>}
                        </span>
                        <NewPasswordButton profileId={a.id} name={a.display_name} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {SELF_SIGNUP_OPEN && (
                <div>
                  <p className="font-medium">Join link</p>
                  <p className="text-xs text-gray-500">
                    Whoever signs up with it joins this club and waits for its admins to approve them.
                    Club admins also have it on the Roster page (Invite via QR code).
                  </p>
                  <p className="break-all text-[var(--color-primary)]">{joinLink}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
