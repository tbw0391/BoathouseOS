import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { clubSlugFromHost, isConsoleHost } from "@/lib/site";

// Every club's data is walled off in the database (0103_clubs.sql): a
// signed-in member only ever reads or writes their own club's rows, and new
// rows pick up their club by themselves. Code using the service role skips
// all that, so it has to say which club it means — these help.

type Admin = ReturnType<typeof createAdminClient>;

// The demo club, on the demo site.
export const DEMO_CLUB_SLUG = "demo";

// The club this address is for: on production the <slug>.boathouseos.app
// in the address, otherwise SITE_CLUB_SLUG (set per deployment), otherwise
// the demo. Signed-out pages show its look, and self-signups join it.
// The console's address (admin.boathouseos.app) is no club's: "" matches none.
export async function siteClubSlug(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (isConsoleHost(host)) return "";
  return clubSlugFromHost(host) ?? process.env.SITE_CLUB_SLUG ?? DEMO_CLUB_SLUG;
}

export async function siteClubId(admin: Admin = createAdminClient()): Promise<string> {
  const slug = await siteClubSlug();
  const { data, error } = await admin.from("clubs").select("id").eq("slug", slug).single();
  if (error || !data) throw new Error(`No club with slug "${slug}".`);
  return (data as { id: string }).id;
}

// The signed-in member's club.
export async function myClubId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_club_id");
  if (error || !data) throw new Error("Couldn't tell which club you're in.");
  return data as string;
}

// A member's club, looked up with the service role.
export async function clubIdOf(admin: Admin, profileId: string): Promise<string> {
  const { data, error } = await admin.from("profiles").select("club_id").eq("id", profileId).single();
  if (error || !data) throw new Error("That member wasn't found.");
  return (data as { club_id: string }).club_id;
}

// The club a roster invite link (/signup?join=...) is for, or null.
export async function clubByJoinCode(
  code: string,
  admin: Admin = createAdminClient()
): Promise<{ id: string; name: string } | null> {
  if (!/^[a-z0-9]{6,32}$/.test(code)) return null;
  const { data } = await admin.from("clubs").select("id, name").eq("join_code", code).maybeSingle();
  return (data as { id: string; name: string } | null) ?? null;
}
