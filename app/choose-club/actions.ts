"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_CLUB_COOKIE, findDemoClub } from "@/lib/demoClubs";

// Per-browser, so each demo visitor sees their own club.
export async function chooseDemoClub(slug: string | null) {
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
  redirect("/");
}
