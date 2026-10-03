"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BoatSide, Role, Team } from "@/lib/database.types";
import { PROFILE_BUTTONS } from "@/lib/profileButtons";
import { tidyErgTime } from "@/lib/erg";
import { SMS_CONSENT_TEXT, canOptInToTexts, normalizeUsPhone, smsBody } from "@/lib/smsRules";
import { sendTextReport, smsConfigured } from "@/lib/sms";
import { UserError, tryAction } from "@/lib/userError";

const VALID_ROLES: Role[] = ["rower", "coxswain", "coach", "parent", "admin"];

export async function updateBio(profileId: string, formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const callerRole = (callerProfile as { role: string } | null)?.role;
    const isSelf = user.id === profileId;
    const isStaff = callerRole === "admin" || callerRole === "coach";
    if (!isSelf && !isStaff) {
      throw new UserError("You can only edit your own bio.");
    }

    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const funFact = String(formData.get("fun_fact") ?? "").trim() || null;
    const walkUpSong = String(formData.get("walk_up_song") ?? "").trim() || null;
    const birthday = String(formData.get("birthday") ?? "").trim() || null;
    const teams = formData.getAll("team") as Team[];
    const photoUrl = String(formData.get("photo_url") ?? "").trim() || null;

    if (!firstName || !lastName) {
      throw new UserError("First and last name are required.");
    }

    // The rowing details are only on the form for rowers, coxswains and
    // masters, so only touch each column when the form included it.
    const rowingUpdate: {
      high_school?: string | null;
      grad_year?: number | null;
      boat_side?: BoatSide | null;
      erg_2k_time?: string | null;
      erg_5k_time?: string | null;
      us_rowing_number?: string | null;
    } = {};
    if (formData.has("high_school")) {
      rowingUpdate.high_school = String(formData.get("high_school") ?? "").trim() || null;
    }
    if (formData.has("grad_year")) {
      const gradYearRaw = String(formData.get("grad_year") ?? "").trim();
      rowingUpdate.grad_year = gradYearRaw ? Number(gradYearRaw) : null;
    }
    if (formData.has("boat_side")) {
      rowingUpdate.boat_side = (String(formData.get("boat_side") ?? "") || null) as BoatSide | null;
    }
    if (formData.has("erg_2k_time")) {
      rowingUpdate.erg_2k_time = tidyErgTime(String(formData.get("erg_2k_time") ?? "").trim()) || null;
    }
    if (formData.has("erg_5k_time")) {
      rowingUpdate.erg_5k_time = tidyErgTime(String(formData.get("erg_5k_time") ?? "").trim()) || null;
    }
    if (formData.has("us_rowing_number")) {
      rowingUpdate.us_rowing_number = String(formData.get("us_rowing_number") ?? "").trim() || null;
    }

    // The spouse field is only rendered for parent profiles, so only touch the
    // column when the form actually included it (avoids clobbering it on
    // saves from other bio forms).
    const spouseUpdate: { spouse_id?: string | null } = {};
    if (formData.has("spouse_id")) {
      const spouseId = String(formData.get("spouse_id") ?? "").trim() || null;
      if (spouseId === profileId) {
        throw new UserError("You can't set yourself as your own spouse.");
      }
      spouseUpdate.spouse_id = spouseId;
    }

    // The role field is only rendered to admins in the UI, but re-check
    // server-side too — a crafted request must not be able to self-promote.
    const roleUpdate: { role?: Role } = {};
    if (formData.has("role")) {
      if (callerRole !== "admin") {
        throw new UserError("Only admins can change a member's role.");
      }
      const roleRaw = String(formData.get("role") ?? "").trim();
      if (!VALID_ROLES.includes(roleRaw as Role)) {
        throw new UserError("Invalid role.");
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
        fun_fact: funFact,
        walk_up_song: walkUpSong,
        birthday,
        photo_url: photoUrl,
        ...rowingUpdate,
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
  });
}

export async function setBoardMember(profileId: string, isBoardMember: boolean) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const callerRole = (callerProfile as { role: string } | null)?.role;
    if (callerRole !== "admin") {
      throw new UserError("Only admins can set board membership.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ is_board_member: isBoardMember })
      .eq("id", profileId);

    if (error) throw new Error(error.message);

    revalidatePath(`/roster/${profileId}`);
    revalidatePath("/roster");
  });
}

export async function setRemoved(profileId: string, removed: boolean) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    if (user.id === profileId) {
      throw new UserError("You can't remove yourself from the roster.");
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const callerRole = (callerProfile as { role: string } | null)?.role;
    if (callerRole !== "admin" && callerRole !== "coach") {
      throw new UserError("Only coaches and admins can remove members.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ disabled_at: removed ? new Date().toISOString() : null })
      .eq("id", profileId);

    if (error) throw new Error(error.message);

    revalidatePath(`/roster/${profileId}`);
    revalidatePath("/roster");
  });
}

// Irreversible: only ever offered once a profile is already soft-removed
// (see setRemoved above). Deletes the profile row itself — the FK rules
// added in 0040_profile_hard_delete_fks.sql ripple that into deleting their
// own messages/photos/tags and detaching (not deleting) shared records like
// events/lineups/boats/polls they created — plus their login, if they have
// one.
export async function permanentlyDeleteProfile(profileId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    if (user.id === profileId) {
      throw new UserError("You can't delete yourself.");
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const callerRole = (callerProfile as { role: string } | null)?.role;
    if (callerRole !== "admin") {
      throw new UserError("Only admins can permanently delete a member.");
    }

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("disabled_at")
      .eq("id", profileId)
      .single();

    if (!(targetProfile as { disabled_at: string | null } | null)?.disabled_at) {
      throw new UserError("Remove this person from the roster before permanently deleting them.");
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
  });
}

// Admin-only, direct set (not an emailed reset link) — this app has no
// outbound email configured, and a small club coach/admin is a faster,
// more reliable path than a "forgot password" email that might never
// arrive. The admin sets the new password themselves and relays it to the
// member directly.
export async function resetMemberPassword(profileId: string, newPassword: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const callerRole = (callerProfile as { role: string } | null)?.role;
    if (callerRole !== "admin") {
      throw new UserError("Only admins can reset another member's password.");
    }

    if (newPassword.length < 8) {
      throw new UserError("Password must be at least 8 characters.");
    }

    // Read as the admin themselves, so it's only found in their own club.
    const { data: target } = await supabase.from("profiles").select("id").eq("id", profileId).maybeSingle();
    if (!target) throw new UserError("That member wasn't found.");

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(profileId, { password: newPassword });
    if (error) {
      if (error.status === 404) {
        throw new UserError("This person doesn't have a login yet (roster-only member) — nothing to reset.");
      }
      throw new Error(error.message);
    }
  });
}

export async function setTentLeader(profileId: string, isTentLeader: boolean) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const callerRole = (callerProfile as { role: string } | null)?.role;
    if (callerRole !== "admin") {
      throw new UserError("Only admins can set tent leaders.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ is_tent_leader: isTentLeader })
      .eq("id", profileId);

    if (error) throw new Error(error.message);

    revalidatePath(`/roster/${profileId}`);
    revalidatePath("/roster");
  });
}

export async function setTreasurer(profileId: string, isTreasurer: boolean) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const callerRole = (callerProfile as { role: string } | null)?.role;
    if (callerRole !== "admin") {
      throw new UserError("Only admins can set the treasurer.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ is_treasurer: isTreasurer })
      .eq("id", profileId);

    if (error) throw new Error(error.message);

    revalidatePath(`/roster/${profileId}`);
    revalidatePath("/roster");
  });
}

export async function setApparelChair(profileId: string, isApparelChair: boolean) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const callerRole = (callerProfile as { role: string } | null)?.role;
    if (callerRole !== "admin") {
      throw new UserError("Only admins can set the apparel chair.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ is_apparel_chair: isApparelChair })
      .eq("id", profileId);

    if (error) throw new Error(error.message);

    revalidatePath(`/roster/${profileId}`);
    revalidatePath("/roster");
  });
}

// Boat or food trailer driver (0132): can track that trailer to regattas.
export async function setTrailerDriver(profileId: string, trailer: "boat" | "food", isDriver: boolean) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if ((callerProfile as { role: string } | null)?.role !== "admin") {
      throw new UserError("Only admins can set the trailer drivers.");
    }

    const { error } = await supabase
      .from("profiles")
      .update(trailer === "boat" ? { is_boat_trailer_driver: isDriver } : { is_food_trailer_driver: isDriver })
      .eq("id", profileId);

    if (error) throw new Error(error.message);

    revalidatePath(`/roster/${profileId}`);
    revalidatePath("/roster");
  });
}

// Your own order for the shortcut buttons on your profile. Null resets to
// the club's default order.
export async function saveProfileButtonOrder(order: string[] | null) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const known = new Set(PROFILE_BUTTONS.map((b) => b.href));
    const clean = Array.isArray(order)
      ? [...new Set(order.filter((href) => typeof href === "string" && known.has(href)))]
      : null;

    const { error } = await supabase
      .from("profiles")
      .update({ profile_button_order: clean?.length ? clean : null })
      .eq("id", user.id);
    if (error) throw new Error(error.message);

    revalidatePath(`/roster/${user.id}`);
  });
}

// Text alerts (0099): opt in with a mobile number and the consent box, or
// turn them off. Only for yourself.
export async function saveTextAlerts(phoneText: string, agreed: boolean) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");
    if (!agreed) throw new UserError("Tick the box to agree to text alerts.");

    const { data: me } = await supabase.from("profiles").select("role, birthday").eq("id", user.id).single();
    const profile = me as { role: string; birthday: string | null } | null;
    if (!profile || !canOptInToTexts(profile.role, profile.birthday)) {
      throw new UserError("Texts for rowers under 18 go to their parents instead.");
    }
    const phone = normalizeUsPhone(phoneText);
    if (!phone) throw new UserError("Enter a US mobile number, like (614) 555-1234.");

    const now = new Date().toISOString();
    const { error } = await supabase.from("sms_consents").upsert(
      { profile_id: user.id, phone, consent_text: SMS_CONSENT_TEXT, consented_at: now, opted_out_at: null, updated_at: now },
      { onConflict: "profile_id" }
    );
    if (error) throw new Error(error.message);
    revalidatePath(`/roster/${user.id}`);
  });
}

export async function turnOffTextAlerts() {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("sms_consents")
      .update({ opted_out_at: now, updated_at: now })
      .eq("profile_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath(`/roster/${user.id}`);
  });
}

// A test text to your own opted-in number, to check texts are working.
// Returns the problem instead of throwing: production hides thrown messages.
export async function sendMyTestText(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!smsConfigured()) return { error: "Texting isn't set up on the site yet: the Twilio settings aren't in this deploy. Add them in Vercel and redeploy." };

  const { data } = await supabase
    .from("sms_consents")
    .select("phone, opted_out_at")
    .eq("profile_id", user.id)
    .maybeSingle();
  const consent = data as { phone: string; opted_out_at: string | null } | null;
  if (!consent || consent.opted_out_at) return { error: "Turn on text alerts first." };

  const result = await sendTextReport(consent.phone, smsBody("Test text", "Text alerts are working."));
  return { error: result };
}

// Sets a member's profile photo straight from their profile page (yourself,
// or a coach/admin). The file is uploaded from the browser to the avatars
// bucket; this only records where it landed, so it only accepts that bucket.
export async function setProfilePhoto(profileId: string, url: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    if (user.id !== profileId) {
      const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const role = (me as { role: string } | null)?.role;
      if (role !== "admin" && role !== "coach") throw new UserError("You can only change your own photo.");
    }

    const bucket = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`;
    if (!url.startsWith(bucket)) throw new UserError("That photo didn't upload properly. Try again.");

    const { error } = await supabase.from("profiles").update({ photo_url: url }).eq("id", profileId);
    if (error) throw new Error(error.message);
    revalidatePath(`/roster/${profileId}`);
    revalidatePath("/", "layout");
  });
}
