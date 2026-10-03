"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { myClubId } from "@/lib/clubs";
import type { Role, BoatSide, Team } from "@/lib/database.types";
import { UserError, tryAction } from "@/lib/userError";

export async function addMember(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role, club_id")
      .eq("id", user.id)
      .single();

    const callerRole = (callerProfile as { role: Role } | null)?.role;
    const clubId = (callerProfile as { club_id: string } | null)?.club_id;
    if (callerRole !== "admin" && callerRole !== "coach") {
      throw new UserError("Only coaches and admins can add members.");
    }

    const email = String(formData.get("email") ?? "").trim();
    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();
    const displayName = `${firstName} ${lastName}`.trim();
    const role = String(formData.get("role") ?? "rower") as Role;
    const boatSideRaw = String(formData.get("boat_side") ?? "");
    const boatSide = (boatSideRaw || null) as BoatSide | null;
    const teams = formData.getAll("team") as Team[];
    const phone = String(formData.get("phone") ?? "").trim() || null;

    const createLogin = formData.get("create_login") === "on";

    if (!email || !firstName || !lastName) {
      throw new UserError("First name, last name, and email are required.");
    }

    const admin = createAdminClient();

    // Without this, re-submitting the same email (e.g. a double-click, or
    // retrying after an unrelated error) hits generateLink's existing-user
    // case, which then throws an unhandled "duplicate key" from Postgres
    // instead of a message anyone can act on.
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingProfile) {
      throw new UserError("A member with this email already exists.");
    }

    if (!createLogin) {
      const { data: inserted, error: profileError } = await admin
        .from("profiles")
        .insert({
          club_id: clubId,
          email,
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
          role,
          boat_side: boatSide,
          phone,
        })
        .select("id")
        .single();

      if (profileError) {
        if (profileError.code === "23505") throw new UserError("A member with this email already exists.");
        throw new Error(profileError.message);
      }

      if (teams.length > 0) {
        const { error: teamsError } = await admin
          .from("profile_teams")
          .insert(teams.map((team) => ({ profile_id: inserted.id, team, club_id: clubId })));
        if (teamsError) throw new Error(teamsError.message);
      }

      revalidatePath("/roster");
      return { inviteLink: null };
    }

    // The login is created already confirmed (2026-10-03, Todd: new people
    // shouldn't have to confirm their email), so a password set any way —
    // the link below, "Forgot password", or an admin's "Reset password" —
    // works straight away. The link signs them in once to set a password.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError || !created.user) {
      const code = (createError as { code?: string } | null)?.code;
      if (code === "email_exists" || /already been registered/i.test(createError?.message ?? "")) {
        throw new UserError("Someone with this email already has a login.");
      }
      throw new Error(createError?.message ?? "Failed to create user.");
    }
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (linkError || !linkData.properties?.hashed_token) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(linkError?.message ?? "Failed to create their set-password link.");
    }
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    const setPasswordLink = `${proto}://${host}/auth/confirm?token_hash=${encodeURIComponent(
      linkData.properties.hashed_token
    )}&type=recovery&next=/reset-password`;

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      club_id: clubId,
      email,
      display_name: displayName,
      first_name: firstName,
      last_name: lastName,
      role,
      boat_side: boatSide,
      phone,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      if (profileError.code === "23505") throw new UserError("A member with this email already exists.");
      throw new Error(profileError.message);
    }

    if (teams.length > 0) {
      const { error: teamsError } = await admin
        .from("profile_teams")
        .insert(teams.map((team) => ({ profile_id: created.user.id, team, club_id: clubId })));
      if (teamsError) throw new Error(teamsError.message);
    }

    revalidatePath("/roster");
    return { inviteLink: setPasswordLink };
  });
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");

  const { data: isAdmin } = await supabase.rpc("is_club_admin");
  if (!isAdmin) throw new UserError("Only admins can approve new members.");
}

export async function approveMember(profileId: string) {
  await requireAdmin();

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ approved_at: new Date().toISOString() })
    .eq("id", profileId)
    .eq("club_id", await myClubId())
    .is("approved_at", null);
  if (error) throw new Error(error.message);

  revalidatePath("/roster");
  revalidatePath("/");
}

// Deletes the pending signup and its login entirely. Only ever touches
// accounts that were never approved.
export async function declineMember(profileId: string) {
  return tryAction(async () => {
    await requireAdmin();

    const admin = createAdminClient();
    const { data: deleted, error } = await admin
      .from("profiles")
      .delete()
      .eq("id", profileId)
      .eq("club_id", await myClubId())
      .is("approved_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!deleted?.length) throw new UserError("That person isn't waiting for approval.");

    const { error: authError } = await admin.auth.admin.deleteUser(profileId);
    if (authError && authError.status !== 404) throw new Error(authError.message);

    revalidatePath("/roster");
    revalidatePath("/");
  });
}
