"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_CLUB_COOKIE, findDemoClub } from "@/lib/demoClubs";
import { isDemoEmail } from "@/lib/demoAccount";
import { IS_DEMO_SITE } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// Per-browser, so each demo visitor sees their own club.
export async function chooseDemoClub(slug: string | null) {
  if (!IS_DEMO_SITE) redirect("/");
  const cookieStore = await cookies();
  const club = findDemoClub(slug);
  if (club) {
    cookieStore.set(DEMO_CLUB_COOKIE, club.slug, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    cookieStore.delete(DEMO_CLUB_COOKIE);
  }
  // Demo visitors pick which type of member to look around as next.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(isDemoEmail(user?.email) ? "/choose-profile" : "/");
}
