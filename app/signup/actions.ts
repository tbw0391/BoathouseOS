"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { siteClubId } from "@/lib/clubs";
import { getClientIp } from "@/lib/clientIp";
import type { Team } from "@/lib/database.types";
import { TERMS_REQUIRED, TERMS_VERSION } from "@/lib/terms";
import { UserError, tryAction } from "@/lib/userError";

const SELF_SIGNUP_ROLES = ["rower", "coxswain", "parent"] as const;
type SelfSignupRole = (typeof SELF_SIGNUP_ROLES)[number];

// This form is public and calls the admin.auth.admin.createUser API directly
// (see below), which bypasses whatever rate limiting Supabase applies to its
// own public signup endpoint. These two limits are our own substitute:
// a per-IP cap, and a honeypot field real users never fill in.
const MAX_SIGNUPS_PER_IP_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function signUp(formData: FormData) {
  return tryAction(async () => {
    // Honeypot: a field named to look real but hidden from sighted users via
    // CSS (see app/signup/page.tsx). Bots that fill in every input trip it;
    // real users never see or fill it. Fail quietly rather than revealing why.
    if (String(formData.get("middle_name") ?? "").trim() !== "") {
      throw new UserError("Something went wrong. Please try again.");
    }

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();
    const roleRaw = String(formData.get("role") ?? "");
    const teams = formData.getAll("team") as Team[];

    if (!email || !password || !firstName || !lastName) {
      throw new UserError("First name, last name, email, and password are required.");
    }
    if (TERMS_REQUIRED && formData.get("agree_terms") !== "on") {
      throw new UserError("Please agree to the Terms of Service and Privacy Policy.");
    }
    if (password.length < 8) {
      throw new UserError("Password must be at least 8 characters.");
    }
    if (!SELF_SIGNUP_ROLES.includes(roleRaw as SelfSignupRole)) {
      throw new UserError("Please choose a valid role.");
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
      throw new UserError("Too many signup attempts from this network. Please try again later.");
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

    // Self-signups join the site's club until invites say which club.
    const clubId = await siteClubId(admin);
    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      club_id: clubId,
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

    // Record the Terms agreement separately, so a database without the terms
    // columns yet (0075) still lets people sign up; they'll get the agree
    // pop-up later instead.
    if (TERMS_REQUIRED) {
      const { error: termsError } = await admin
        .from("profiles")
        .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
        .eq("id", created.user.id);
      if (termsError) console.error("Couldn't record terms agreement", termsError.message);
    }

    if (teams.length > 0) {
      const { error: teamsError } = await admin
        .from("profile_teams")
        .insert(teams.map((team) => ({ profile_id: created.user.id, team, club_id: clubId })));
      if (teamsError) throw new Error(teamsError.message);
    }
  });
}
