import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateClubForm } from "./CreateClubForm";
import { allAuthUsers, consoleUser, daysAgo, formatWhen } from "@/lib/console";
import { clubAddress } from "@/lib/site";
import { Badge, ConsolePage, NotGlobalAdmin } from "../ui";

type ClubRow = { id: string; name: string; slug: string; created_at: string; suspended_at: string | null };
type Person = { id: string; club_id: string; approved_at: string | null; disabled_at: string | null };
type Payments = { club_id: string; stripe_account_id: string | null; stripe_charges_enabled: boolean };

// Every club, read with the service role.
export default async function ClubsPage() {
  const me = await consoleUser();
  if (!me) return <NotGlobalAdmin />;

  const admin = createAdminClient();
  const [{ data: clubData }, { data: peopleData }, { data: payData }, users] = await Promise.all([
    admin.from("clubs").select("id, name, slug, created_at, suspended_at").order("name"),
    admin.from("profiles").select("id, club_id, approved_at, disabled_at"),
    admin.from("payment_settings").select("club_id, stripe_account_id, stripe_charges_enabled"),
    allAuthUsers(admin),
  ]);
  const clubs = (clubData as ClubRow[] | null) ?? [];
  const people = (peopleData as Person[] | null) ?? [];
  const payments = new Map(((payData as Payments[] | null) ?? []).map((p) => [p.club_id, p]));
  const lastSignIn = new Map(users.map((u) => [u.id, u.last_sign_in_at]));
  const weekAgo = daysAgo(7);

  return (
    <ConsolePage title="Clubs" subtitle={`${clubs.length} club${clubs.length === 1 ? "" : "s"}`}>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b">
            <tr>
              <th className="px-3 py-2 font-medium">Club</th>
              <th className="px-3 py-2 font-medium">Members</th>
              <th className="px-3 py-2 font-medium">Waiting</th>
              <th className="px-3 py-2 font-medium">Active this week</th>
              <th className="px-3 py-2 font-medium">Last sign-in</th>
              <th className="px-3 py-2 font-medium">Card payments</th>
            </tr>
          </thead>
          <tbody>
            {clubs.map((club) => {
              const members = people.filter((p) => p.club_id === club.id);
              const active = members.filter((p) => p.approved_at && !p.disabled_at);
              const waiting = members.filter((p) => !p.approved_at && !p.disabled_at);
              const signIns = active.map((p) => lastSignIn.get(p.id)).filter((t): t is string => !!t).sort();
              const pay = payments.get(club.id);
              return (
                <tr key={club.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link href={`/console/clubs/${club.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                      {club.name}
                    </Link>{" "}
                    {club.suspended_at && <Badge tone="red">suspended</Badge>}
                    <p className="text-xs text-gray-500">{clubAddress(club.slug)}</p>
                  </td>
                  <td className="px-3 py-2">{active.length}</td>
                  <td className="px-3 py-2">{waiting.length || ""}</td>
                  <td className="px-3 py-2">{signIns.filter((t) => t > weekAgo).length}</td>
                  <td className="px-3 py-2 text-gray-600">{signIns.length ? formatWhen(signIns[signIns.length - 1]) : "never"}</td>
                  <td className="px-3 py-2">
                    {pay?.stripe_charges_enabled ? (
                      <Badge tone="green">Stripe on</Badge>
                    ) : pay?.stripe_account_id ? (
                      <Badge tone="amber">Stripe setup unfinished</Badge>
                    ) : (
                      <Badge>not connected</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CreateClubForm />
    </ConsolePage>
  );
}
