"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Team } from "@/lib/database.types";

const SELF_SIGNUP_ROLES = ["rower", "coxswain", "parent"] as const;
type SelfSignupRole = (typeof SELF_SIGNUP_ROLES)[number];

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "");
  const teams = formData.getAll("team") as Team[];

  if (!email || !password || !firstName || !lastName) {
    throw new Error("First name, last name, email, and password are required.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (!SELF_SIGNUP_ROLES.includes(roleRaw as SelfSignupRole)) {
    throw new Error("Please choose a valid role.");
  }
  const role = roleRaw as SelfSignupRole;

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Couldn't create an account with that email.");
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    email,
    display_name: `${firstName} ${lastName}`.trim(),
    first_name: firstName,
    last_name: lastName,
    role,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error(profileError.message);
  }

  if (teams.length > 0) {
    const { error: teamsError } = await admin
      .from("profile_teams")
      .insert(teams.map((team) => ({ profile_id: created.user.id, team })));
    if (teamsError) throw new Error(teamsError.message);
  }
}
