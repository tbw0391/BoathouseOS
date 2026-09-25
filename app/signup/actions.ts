"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/clientIp";
import type { Team } from "@/lib/database.types";

const SELF_SIGNUP_ROLES = ["rower", "coxswain", "parent"] as const;
type SelfSignupRole = (typeof SELF_SIGNUP_ROLES)[number];

// This form is public and calls the admin.auth.admin.createUser API directly
// (see below), which bypasses whatever rate limiting Supabase applies to its
// own public signup endpoint. These two limits are our own substitute:
// a per-IP cap, and a honeypot field real users never fill in.
const MAX_SIGNUPS_PER_IP_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function signUp(formData: FormData) {
  // Honeypot: a field named to look real but hidden from sighted users via
  // CSS (see app/signup/page.tsx). Bots that fill in every input trip it;
  // real users never see or fill it. Fail quietly rather than revealing why.
  if (String(formData.get("middle_name") ?? "").trim() !== "") {
    throw new Error("Something went wrong. Please try again.");
  }

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

  const ip = await getClientIp();
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("signup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= MAX_SIGNUPS_PER_IP_PER_HOUR) {
    throw new Error("Too many signup attempts from this network. Please try again later.");
  }

  await admin.from("signup_attempts").insert({ ip });

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
    // Pending until an admin approves them (see 0060_member_approval.sql).
    approved_at: null,
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
