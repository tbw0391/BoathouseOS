"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role, BoatSide, Team } from "@/lib/database.types";

export async function addMember(formData: FormData) {
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

  const callerRole = (callerProfile as { role: Role } | null)?.role;
  if (callerRole !== "admin" && callerRole !== "coach") {
    throw new Error("Only coaches and admins can add members.");
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
    throw new Error("First name, last name, and email are required.");
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
    throw new Error("A member with this email already exists.");
  }

  if (!createLogin) {
    const { data: inserted, error: profileError } = await admin
      .from("profiles")
      .insert({
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
      if (profileError.code === "23505") throw new Error("A member with this email already exists.");
      throw new Error(profileError.message);
    }

    if (teams.length > 0) {
      const { error: teamsError } = await admin
        .from("profile_teams")
        .insert(teams.map((team) => ({ profile_id: inserted.id, team })));
      if (teamsError) throw new Error(teamsError.message);
    }

    revalidatePath("/roster");
    return { inviteLink: null };
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
  });

  if (linkError || !linkData.user) {
    throw new Error(linkError?.message ?? "Failed to create user.");
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: linkData.user.id,
    email,
    display_name: displayName,
    first_name: firstName,
    last_name: lastName,
    role,
    boat_side: boatSide,
    phone,
  });

  if (profileError) {
    if (profileError.code === "23505") throw new Error("A member with this email already exists.");
    throw new Error(profileError.message);
  }

  if (teams.length > 0) {
    const { error: teamsError } = await admin
      .from("profile_teams")
      .insert(teams.map((team) => ({ profile_id: linkData.user.id, team })));
    if (teamsError) throw new Error(teamsError.message);
  }

  revalidatePath("/roster");
  return { inviteLink: linkData.properties.action_link };
}
