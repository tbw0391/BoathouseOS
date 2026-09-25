"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// One shared account everyone lands in from the "Try the demo" button, so
// visiting clubs can look around without signing up. It's an admin so every
// screen is visible. Only safe because this project's database holds demo
// data only — never point this build at a real club's Supabase project.
const DEMO_EMAIL = "demo@boathouseos.app";

export async function signInAsDemo() {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", DEMO_EMAIL)
    .maybeSingle();

  if (!existing) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      email_confirm: true,
    });
    if (createError || !created.user) {
      throw new Error(createError?.message ?? "Couldn't set up the demo account.");
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      email: DEMO_EMAIL,
      display_name: "Demo User",
      first_name: "Demo",
      last_name: "User",
      role: "admin",
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(profileError.message);
    }
  }

  // Mint a one-time magic-link token server-side and redeem it right away,
  // which sets the session cookie without any email being sent.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_EMAIL,
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

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
