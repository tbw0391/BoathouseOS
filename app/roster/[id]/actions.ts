"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BoatSide, Role, Team } from "@/lib/database.types";

const VALID_ROLES: Role[] = ["rower", "coxswain", "coach", "parent", "admin"];

export async function updateBio(profileId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const callerRole = (callerProfile as { role: string } | null)?.role;
  const isSelf = user.id === profileId;
  const isStaff = callerRole === "admin" || callerRole === "coach";
  if (!isSelf && !isStaff) {
    throw new Error("You can only edit your own bio.");
  }

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const highSchool = String(formData.get("high_school") ?? "").trim() || null;
  const gradYearRaw = String(formData.get("grad_year") ?? "").trim();
  const gradYear = gradYearRaw ? Number(gradYearRaw) : null;
  const funFact = String(formData.get("fun_fact") ?? "").trim() || null;
  const walkUpSong = String(formData.get("walk_up_song") ?? "").trim() || null;
  const birthday = String(formData.get("birthday") ?? "").trim() || null;
  const boatSideRaw = String(formData.get("boat_side") ?? "");
  const boatSide = (boatSideRaw || null) as BoatSide | null;
  const teams = formData.getAll("team") as Team[];
  const photoUrl = String(formData.get("photo_url") ?? "").trim() || null;
  const erg2kTime = String(formData.get("erg_2k_time") ?? "").trim() || null;
  const erg5kTime = String(formData.get("erg_5k_time") ?? "").trim() || null;
  const usRowingNumber = String(formData.get("us_rowing_number") ?? "").trim() || null;

  if (!firstName || !lastName) {
    throw new Error("First and last name are required.");
  }

  // The spouse field is only rendered for parent profiles, so only touch the
  // column when the form actually included it (avoids clobbering it on
  // saves from other bio forms).
  const spouseUpdate: { spouse_id?: string | null } = {};
  if (formData.has("spouse_id")) {
    const spouseId = String(formData.get("spouse_id") ?? "").trim() || null;
    if (spouseId === profileId) {
      throw new Error("You can't set yourself as your own spouse.");
    }
    spouseUpdate.spouse_id = spouseId;
  }

  // The role field is only rendered to admins in the UI, but re-check
  // server-side too — a crafted request must not be able to self-promote.
  const roleUpdate: { role?: Role } = {};
  if (formData.has("role")) {
    if (callerRole !== "admin") {
      throw new Error("Only admins can change a member's role.");
    }
    const roleRaw = String(formData.get("role") ?? "").trim();
    if (!VALID_ROLES.includes(roleRaw as Role)) {
      throw new Error("Invalid role.");
    }
    roleUpdate.role = roleRaw as Role;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      display_name: `${firstName} ${lastName}`.trim(),
      address,
      phone,
      high_school: highSchool,
      grad_year: gradYear,
      fun_fact: funFact,
      walk_up_song: walkUpSong,
      birthday,
      boat_side: boatSide,
      photo_url: photoUrl,
      erg_2k_time: erg2kTime,
      erg_5k_time: erg5kTime,
      us_rowing_number: usRowingNumber,
      ...spouseUpdate,
      ...roleUpdate,
    })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  const { error: deleteTeamsError } = await supabase
    .from("profile_teams")
    .delete()
    .eq("profile_id", profileId);
  if (deleteTeamsError) throw new Error(deleteTeamsError.message);

  if (teams.length > 0) {
    const { error: teamsError } = await supabase
      .from("profile_teams")
      .insert(teams.map((team) => ({ profile_id: profileId, team })));
    if (teamsError) throw new Error(teamsError.message);
  }

  // The family picker is rendered for parent/admin/coach and rower/coxswain
  // profiles (admin/coach included since staff can also be a real parent),
  // and its direction depends on which one is being edited: a
  // parent/admin/coach picks their rower children (they become the
  // guardian side), a rower/coxswain picks their parent(s) (they become
  // the rower side).
  if (formData.has("family_field_present")) {
    const familyMemberIds = [...new Set(formData.getAll("family_member_id").map(String))];

    const { data: targetProfileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", profileId)
      .single();
    const targetRole = (targetProfileData as { role: string } | null)?.role;

    if (targetRole === "parent" || targetRole === "admin" || targetRole === "coach") {
      const { error: deleteFamilyError } = await supabase
        .from("family_links")
        .delete()
        .eq("guardian_id", profileId);
      if (deleteFamilyError) throw new Error(deleteFamilyError.message);

      if (familyMemberIds.length > 0) {
        const { error: familyError } = await supabase
          .from("family_links")
          .insert(familyMemberIds.map((rowerId) => ({ guardian_id: profileId, rower_id: rowerId })));
        if (familyError) throw new Error(familyError.message);
      }
    } else if (targetRole === "rower" || targetRole === "coxswain") {
      const { error: deleteFamilyError } = await supabase
        .from("family_links")
        .delete()
        .eq("rower_id", profileId);
      if (deleteFamilyError) throw new Error(deleteFamilyError.message);

      if (familyMemberIds.length > 0) {
        const { error: familyError } = await supabase
          .from("family_links")
          .insert(
            familyMemberIds.map((guardianId) => ({ guardian_id: guardianId, rower_id: profileId }))
          );
        if (familyError) throw new Error(familyError.message);
      }
    }
  }

  revalidatePath(`/roster/${profileId}`);
  revalidatePath("/roster");
}

export async function setBoardMember(profileId: string, isBoardMember: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "admin") {
    throw new Error("Only admins can set board membership.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_board_member: isBoardMember })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  revalidatePath(`/roster/${profileId}`);
  revalidatePath("/roster");
}

export async function setRemoved(profileId: string, removed: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  if (user.id === profileId) {
    throw new Error("You can't remove yourself from the roster.");
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "admin" && callerRole !== "coach") {
    throw new Error("Only coaches and admins can remove members.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ disabled_at: removed ? new Date().toISOString() : null })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  revalidatePath(`/roster/${profileId}`);
  revalidatePath("/roster");
}

// Irreversible: only ever offered once a profile is already soft-removed
// (see setRemoved above). Deletes the profile row itself — the FK rules
// added in 0040_profile_hard_delete_fks.sql ripple that into deleting their
// own messages/photos/tags and detaching (not deleting) shared records like
// events/lineups/boats/polls they created — plus their login, if they have
// one.
export async function permanentlyDeleteProfile(profileId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  if (user.id === profileId) {
    throw new Error("You can't delete yourself.");
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "admin") {
    throw new Error("Only admins can permanently delete a member.");
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("disabled_at")
    .eq("id", profileId)
    .single();

  if (!(targetProfile as { disabled_at: string | null } | null)?.disabled_at) {
    throw new Error("Remove this person from the roster before permanently deleting them.");
  }

  const admin = createAdminClient();

  const { error } = await admin.from("profiles").delete().eq("id", profileId);
  if (error) throw new Error(error.message);

  // Roster-only members (added without an invite) have no matching
  // auth.users row, so "not found" here just means there was no login to
  // remove, not a failure.
  const { error: authError } = await admin.auth.admin.deleteUser(profileId);
  if (authError && authError.status !== 404) throw new Error(authError.message);

  revalidatePath("/roster");
}

export async function setTentLeader(profileId: string, isTentLeader: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "admin") {
    throw new Error("Only admins can set tent leaders.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_tent_leader: isTentLeader })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  revalidatePath(`/roster/${profileId}`);
  revalidatePath("/roster");
}
