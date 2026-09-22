import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileTeam, Team } from "@/lib/database.types";
import { AddMemberForm } from "./AddMemberForm";
import { ImportForm } from "./ImportForm";
import { SignupQrButton } from "./SignupQrButton";
import { RosterTable } from "./RosterTable";

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
  const teamsByProfile: Record<string, Team[]> = {};
  for (const row of (teamRows as ProfileTeam[] | null) ?? []) {
    const existing = teamsByProfile[row.profile_id] ?? [];
    existing.push(row.team);
    teamsByProfile[row.profile_id] = existing;
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

      {profiles.length > 0 && <RosterTable profiles={profiles} teamsByProfile={teamsByProfile} />}
    </div>
  );
}
