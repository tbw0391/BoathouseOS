import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileTeam } from "@/lib/database.types";
import { AddMemberForm } from "./AddMemberForm";
import { ImportForm } from "./ImportForm";
import { SignupQrButton } from "./SignupQrButton";
import { TEAM_LABELS } from "@/lib/teams";

const ROLE_LABELS: Record<Profile["role"], string> = {
  rower: "Rower",
  coxswain: "Coxswain",
  coach: "Coach",
  parent: "Parent",
  admin: "Admin",
};

export default async function RosterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("display_name", { ascending: true });

  const allProfiles = (data as Profile[] | null) ?? [];
  const currentProfile = allProfiles.find((p) => p.id === user?.id);
  const canManage = currentProfile?.role === "admin" || currentProfile?.role === "coach";
  const profiles = canManage ? allProfiles : allProfiles.filter((p) => !p.disabled_at);

  const { data: teamRows } = await supabase.from("profile_teams").select("*");
  const teamsByProfile = new Map<string, ProfileTeam["team"][]>();
  for (const row of (teamRows as ProfileTeam[] | null) ?? []) {
    const existing = teamsByProfile.get(row.profile_id) ?? [];
    existing.push(row.team);
    teamsByProfile.set(row.profile_id, existing);
  }

  return (
    <div className="min-h-screen p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Roster</h1>
        <span className="text-sm text-gray-500">
          {profiles.filter((p) => !p.disabled_at).length} members
        </span>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-start gap-2">
          <AddMemberForm />
          <ImportForm />
          <SignupQrButton />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 mt-4">
          Couldn&apos;t load roster: {error.message}
        </p>
      )}

      {!error && profiles.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">No members yet.</p>
      )}

      {profiles.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4"></th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Group</th>
                <th className="py-2 pr-4">Side</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Email</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b last:border-0 ${p.disabled_at ? "opacity-50" : ""}`}
                >
                  <td className="py-2 pr-4">
                    <Link href={`/roster/${p.id}`}>
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photo_url}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full border flex items-center justify-center text-[10px] text-gray-400">
                          —
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 font-medium">
                    <Link href={`/roster/${p.id}`} className="hover:underline">
                      {p.display_name}
                    </Link>
                    {p.disabled_at && (
                      <span className="ml-2 text-xs text-red-600 font-normal">Removed</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{ROLE_LABELS[p.role]}</td>
                  <td className="py-2 pr-4">
                    {(teamsByProfile.get(p.id) ?? []).map((t) => TEAM_LABELS[t]).join(", ") || "—"}
                  </td>
                  <td className="py-2 pr-4 capitalize">{p.boat_side ?? "—"}</td>
                  <td className="py-2 pr-4">{p.phone ?? "—"}</td>
                  <td className="py-2 pr-4">{p.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
