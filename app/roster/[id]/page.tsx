import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";
import { BioForm } from "./BioForm";
import { RoleToggle } from "./RoleToggle";
import { setBoardMember, setTentLeader } from "./actions";
import { TEAM_LABELS } from "@/lib/teams";

const ROLE_LABELS: Record<Profile["role"], string> = {
  rower: "Rower",
  coxswain: "Coxswain",
  coach: "Coach",
  parent: "Parent",
  admin: "Admin",
};

export default async function BioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const profile = data as Profile;

  const { data: callerData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  const callerRole = (callerData as { role: string } | null)?.role;
  const isSelf = user?.id === profile.id;
  const canEdit = isSelf || callerRole === "admin" || callerRole === "coach";
  const isCallerAdmin = callerRole === "admin";

  if (edit === "1" && canEdit) {
    return (
      <div className="min-h-screen p-8">
        <Link href={`/roster/${id}`} className="text-sm text-gray-500 hover:underline">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-4">Edit bio</h1>
        <BioForm profile={profile} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <Link href="/roster" className="text-sm text-gray-500 hover:underline">
        ← Roster
      </Link>

      <div className="mt-4 flex items-start gap-4">
        {profile.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.photo_url}
            alt=""
            className="w-40 h-40 rounded-full object-cover border"
          />
        ) : (
          <div className="w-40 h-40 rounded-full border flex items-center justify-center text-sm text-gray-400">
            No photo
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-gray-500">
            {ROLE_LABELS[profile.role]}
            {profile.team && ` · ${TEAM_LABELS[profile.team]}`}
            {profile.is_board_member && " · Board Member"}
            {profile.is_tent_leader && " · Tent Leader"}
          </p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          {canEdit && (
            <Link
              href={`/roster/${id}?edit=1`}
              className="text-sm bg-[#404040] text-white border-2 border-[#022e5d] rounded px-3 py-2"
            >
              Edit
            </Link>
          )}
          {isCallerAdmin && (
            <RoleToggle
              initialValue={profile.is_board_member}
              onLabel="Make board member"
              offLabel="Remove from board"
              onToggle={setBoardMember.bind(null, profile.id)}
            />
          )}
          {isCallerAdmin && (
            <RoleToggle
              initialValue={profile.is_tent_leader}
              onLabel="Make tent leader"
              offLabel="Remove as tent leader"
              onToggle={setTentLeader.bind(null, profile.id)}
            />
          )}
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm max-w-md">
        <dt className="text-gray-500">Group</dt>
        <dd>{profile.team ? TEAM_LABELS[profile.team] : "—"}</dd>

        <dt className="text-gray-500">Email</dt>
        <dd>{profile.email}</dd>

        <dt className="text-gray-500">Phone</dt>
        <dd>{profile.phone ?? "—"}</dd>

        <dt className="text-gray-500">Address</dt>
        <dd>{profile.address ?? "—"}</dd>

        <dt className="text-gray-500">Birthday</dt>
        <dd>{profile.birthday ?? "—"}</dd>

        <dt className="text-gray-500">High school</dt>
        <dd>{profile.high_school ?? "—"}</dd>

        <dt className="text-gray-500">Grad year</dt>
        <dd>{profile.grad_year ?? "—"}</dd>

        <dt className="text-gray-500">Boat side</dt>
        <dd className="capitalize">{profile.boat_side ?? "—"}</dd>

        <dt className="text-gray-500">2K time</dt>
        <dd>{profile.erg_2k_time ?? "—"}</dd>

        <dt className="text-gray-500">5K time</dt>
        <dd>{profile.erg_5k_time ?? "—"}</dd>

        <dt className="text-gray-500">US Rowing #</dt>
        <dd>{profile.us_rowing_number ?? "—"}</dd>

        <dt className="text-gray-500">Fun fact</dt>
        <dd>{profile.fun_fact ?? "—"}</dd>
      </dl>
    </div>
  );
}
