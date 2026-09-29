"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteClubId } from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";
import { findDemoProfile, isDemoEmail, type DemoProfile } from "@/lib/demoAccount";
import { forgetThisDevicesPush } from "@/lib/push";
import { UserError, tryAction } from "@/lib/userError";

// "Try the demo" signs in as the admin, then /choose-club and
// /choose-profile let the visitor switch to another type of user.
export async function signInAsDemo() {
  await signInToDemoAccount(findDemoProfile("admin")!);
  redirect("/choose-club");
}

export async function switchDemoProfile(role: string) {
  return tryAction(async () => {
    const profile = findDemoProfile(role);
    if (!profile) throw new UserError("Unknown demo profile.");
    // Only from inside the demo, so a real member can't be swapped out of
    // their own account by a stray link.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!isDemoEmail(user?.email)) throw new UserError("Only available in the demo.");

    await signInToDemoAccount(profile);
    redirect("/");
  });
}

// Each type of user is its own shared account, created the first time
// someone picks it.
async function signInToDemoAccount(profile: DemoProfile) {
  const admin = createAdminClient();
  const userId = await ensureDemoAccount(admin, profile);
  if (profile.role === "parent") {
    // The demo parent's rower is the demo rower.
    const rowerId = await ensureDemoAccount(admin, findDemoProfile("rower")!);
    await admin
      .from("family_links")
      .upsert({ guardian_id: userId, rower_id: rowerId, club_id: await siteClubId(admin) }, { ignoreDuplicates: true });
  }

  // Mint a one-time magic-link token server-side and redeem it right away,
  // which sets the session cookie without any email being sent.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
  });
  if (linkError || !link.properties?.hashed_token) {
    throw new Error(linkError?.message ?? "Couldn't sign in to the demo.");
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) throw new Error(verifyError.message);
}

async function ensureDemoAccount(
  admin: ReturnType<typeof createAdminClient>,
  profile: DemoProfile
): Promise<string> {
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", profile.email)
    .maybeSingle();
  if (existing) {
    // Visitors signed in as the demo admin can edit these like any member;
    // put the basics back so each type of user keeps working.
    await admin
      .from("profiles")
      .update({ role: profile.role, disabled_at: null })
      .eq("id", existing.id);
    await admin
      .from("profiles")
      .update({ approved_at: new Date().toISOString() })
      .eq("id", existing.id)
      .is("approved_at", null);
    return existing.id;
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: profile.email,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Couldn't set up the demo account.");
  }

  const lastName = profile.role === "admin" ? "User" : profile.label;
  // The demo accounts live in the demo club.
  const clubId = await siteClubId(admin);
  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    club_id: clubId,
    email: profile.email,
    display_name: `Demo ${lastName}`,
    first_name: "Demo",
    last_name: lastName,
    role: profile.role,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error(profileError.message);
  }
  if (profile.team) {
    await admin.from("profile_teams").insert({ profile_id: created.user.id, team: profile.team, club_id: clubId });
  }
  return created.user.id;
}

export async function signOut() {
  // Stop this device getting the signed-out person's alerts.
  await forgetThisDevicesPush();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
