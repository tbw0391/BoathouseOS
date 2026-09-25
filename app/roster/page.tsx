import { createClient } from "@/lib/supabase/server";
import type { ProfileTeam, Team } from "@/lib/database.types";
import { AddMemberForm } from "./AddMemberForm";
import { ImportForm } from "./ImportForm";
import { SignupQrButton } from "./SignupQrButton";
import { RosterGrid, type RosterProfile } from "./RosterGrid";
import { PendingApprovals } from "./PendingApprovals";

const ROSTER_COLUMNS =
  "id, email, display_name, role, phone, boat_side, disabled_at, first_name, last_name, photo_url, is_board_member, approved_at";

export default async function RosterPage() {
  const supabase = await createClient();

  // Only the columns the roster table and its manage-permission check
  // actually use — not the full profile (bio, address, erg times, etc.).
  const [
    {
      data: { user },
    },
    { data, error },
    { data: teamRows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select(ROSTER_COLUMNS).order("display_name", { ascending: true }),
    supabase.from("profile_teams").select("*"),
  ]);

  // Pending self-signups only come back for admins (RLS), and are listed
  // separately rather than in the roster itself.
  const fetched = (data as (RosterProfile & { approved_at: string | null })[] | null) ?? [];
  const pendingMembers = fetched.filter((p) => !p.approved_at && p.id !== user?.id);
  const allProfiles = fetched.filter((p) => p.approved_at);
  const currentProfile = allProfiles.find((p) => p.id === user?.id);
  const canManage = currentProfile?.role === "admin" || currentProfile?.role === "coach";
  const profiles = canManage ? allProfiles : allProfiles.filter((p) => !p.disabled_at);

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

      {pendingMembers.length > 0 && <PendingApprovals members={pendingMembers} />}

      {error && (
        <p className="text-sm text-red-600 mt-4">
          Couldn&apos;t load roster: {error.message}
        </p>
      )}

      {!error && profiles.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">No members yet.</p>
      )}

      {profiles.length > 0 && <RosterGrid profiles={profiles} teamsByProfile={teamsByProfile} />}
    </div>
  );
}
