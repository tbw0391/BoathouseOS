import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FamilyLink, Photo, PhotoTag, Profile, ProfileTeam } from "@/lib/database.types";
import { BioForm } from "./BioForm";
import { RoleToggle } from "./RoleToggle";
import { RemoveMemberButton } from "./RemoveMemberButton";
import { PermanentlyDeleteButton } from "./PermanentlyDeleteButton";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { LogOutButton } from "./LogOutButton";
import { setBoardMember, setTentLeader, setRemoved, permanentlyDeleteProfile, resetMemberPassword } from "./actions";
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

  const { data: teamRows } = await supabase
    .from("profile_teams")
    .select("team")
    .eq("profile_id", profile.id);
  const teams = ((teamRows as Pick<ProfileTeam, "team">[] | null) ?? []).map((t) => t.team);

  const { data: callerData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  const callerRole = (callerData as { role: string } | null)?.role;
  const isSelf = user?.id === profile.id;
  const canEdit = isSelf || callerRole === "admin" || callerRole === "coach";
  const isCallerAdmin = callerRole === "admin";
  const canRemove = !isSelf && (callerRole === "admin" || callerRole === "coach");

  const { data: tagRows } = await supabase
    .from("photo_tags")
    .select("photo_id")
    .eq("profile_id", profile.id);
  const photoIds = ((tagRows as Pick<PhotoTag, "photo_id">[] | null) ?? []).map((t) => t.photo_id);

  let taggedPhotos: Photo[] = [];
  if (photoIds.length > 0) {
    const { data: photosData } = await supabase
      .from("photos")
      .select("*")
      .in("id", photoIds)
      .order("created_at", { ascending: false });
    taggedPhotos = (photosData as Photo[] | null) ?? [];
  }

  let spouseOptions: Pick<Profile, "id" | "display_name">[] = [];
  let spouseName: string | null = null;
  if (profile.role === "parent") {
    const { data: parentRows } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("role", "parent")
      .is("disabled_at", null)
      .neq("id", profile.id)
      .order("display_name", { ascending: true });
    spouseOptions = (parentRows as Pick<Profile, "id" | "display_name">[] | null) ?? [];

    if (profile.spouse_id) {
      spouseName = spouseOptions.find((p) => p.id === profile.spouse_id)?.display_name ?? null;
    }
  }

  let familyOptions: Pick<Profile, "id" | "display_name">[] = [];
  let familyValue: string[] = [];
  let familyNames: string[] = [];
  const isGuardianRole = profile.role === "parent" || profile.role === "admin" || profile.role === "coach";
  if (isGuardianRole) {
    const { data: rowerRows } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("role", ["rower", "coxswain"])
      .is("disabled_at", null)
      .order("display_name", { ascending: true });
    familyOptions = (rowerRows as Pick<Profile, "id" | "display_name">[] | null) ?? [];

    const { data: linkRows } = await supabase
      .from("family_links")
      .select("*")
      .eq("guardian_id", profile.id);
    const links = (linkRows as FamilyLink[] | null) ?? [];
    familyValue = links.map((l) => l.rower_id);
    familyNames = familyValue.map(
      (id) => familyOptions.find((p) => p.id === id)?.display_name ?? "Unknown"
    );
  } else if (profile.role === "rower" || profile.role === "coxswain") {
    const { data: parentRows } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("role", ["parent", "admin", "coach"])
      .is("disabled_at", null)
      .order("display_name", { ascending: true });
    familyOptions = (parentRows as Pick<Profile, "id" | "display_name">[] | null) ?? [];

    const { data: linkRows } = await supabase
      .from("family_links")
      .select("*")
      .eq("rower_id", profile.id);
    const links = (linkRows as FamilyLink[] | null) ?? [];
    familyValue = links.map((l) => l.guardian_id);
    familyNames = familyValue.map(
      (id) => familyOptions.find((p) => p.id === id)?.display_name ?? "Unknown"
    );
  }

  if (edit === "1" && canEdit) {
    return (
      <div className="min-h-screen p-8">
        <Link href={`/roster/${id}`} className="text-sm text-gray-500 hover:underline">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-4">Edit bio</h1>
        <BioForm
          profile={profile}
          teams={teams}
          spouseOptions={spouseOptions}
          familyOptions={familyOptions}
          familyValue={familyValue}
          canEditRole={isCallerAdmin}
        />
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
            {teams.length > 0 && ` · ${teams.map((t) => TEAM_LABELS[t]).join(", ")}`}
            {profile.is_board_member && " · Board Member"}
            {profile.is_tent_leader && " · Tent Leader"}
          </p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          {canEdit && (
            <Link
              href={`/roster/${id}?edit=1`}
              className="w-52 text-center text-sm bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2"
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
          {canRemove && (
            <RemoveMemberButton
              name={profile.display_name}
              isRemoved={profile.disabled_at !== null}
              onToggle={setRemoved.bind(null, profile.id)}
            />
          )}
          {isCallerAdmin && (
            <ResetPasswordButton
              name={profile.display_name}
              onReset={resetMemberPassword.bind(null, profile.id)}
            />
          )}
          {isSelf && <LogOutButton />}
        </div>
      </div>

      {profile.disabled_at && (
        <p className="mt-4 text-sm text-red-600">
          This person was removed from the roster on{" "}
          {new Date(profile.disabled_at).toLocaleDateString()}.
        </p>
      )}

      {isCallerAdmin && profile.disabled_at && (
        <div className="mt-2">
          <PermanentlyDeleteButton
            name={profile.display_name}
            onDelete={permanentlyDeleteProfile.bind(null, profile.id)}
          />
        </div>
      )}

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm max-w-md">
        <dt className="text-gray-500">Group</dt>
        <dd>{teams.length > 0 ? teams.map((t) => TEAM_LABELS[t]).join(", ") : "—"}</dd>

        <dt className="text-gray-500">Email</dt>
        <dd>{profile.email}</dd>

        <dt className="text-gray-500">Phone</dt>
        <dd>{profile.phone ?? "—"}</dd>

        <dt className="text-gray-500">Address</dt>
        <dd>{profile.address ?? "—"}</dd>

        <dt className="text-gray-500">Birthday</dt>
        <dd>{profile.birthday ?? "—"}</dd>

        {profile.role !== "parent" && (
          <>
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
          </>
        )}

        <dt className="text-gray-500">Walk up song</dt>
        <dd>{profile.walk_up_song ?? "—"}</dd>

        {profile.role === "parent" && (
          <>
            <dt className="text-gray-500">Spouse</dt>
            <dd>{spouseName ?? "—"}</dd>
          </>
        )}

        {(isGuardianRole || profile.role === "rower" || profile.role === "coxswain") && (
          <>
            <dt className="text-gray-500">{isGuardianRole ? "Children" : "Parent/Guardian"}</dt>
            <dd>{familyNames.length > 0 ? familyNames.join(", ") : "—"}</dd>
          </>
        )}

        <dt className="text-gray-500">Fun fact</dt>
        <dd>{profile.fun_fact ?? "—"}</dd>
      </dl>

      {taggedPhotos.length > 0 && (
        <div className="mt-6 max-w-lg">
          <h2 className="text-sm font-medium text-gray-600 mb-2">Photos</h2>
          <div className="grid grid-cols-3 gap-2">
            {taggedPhotos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={photo.url}
                alt={photo.caption ?? ""}
                className="w-full aspect-square object-cover rounded"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
