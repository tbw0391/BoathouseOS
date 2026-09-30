import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Every club's data is walled off in the database (0103_clubs.sql): a
// signed-in member only ever reads or writes their own club's rows, and new
// rows pick up their club by themselves. Code using the service role skips
// all that, so it has to say which club it means — these help.

type Admin = ReturnType<typeof createAdminClient>;

// The club whose look signed-out pages show and that self-signups join
// (until invites say which club). On boathouseos.app that's the demo.
export const SITE_CLUB_SLUG = "demo";

export async function siteClubId(admin: Admin = createAdminClient()): Promise<string> {
  const { data, error } = await admin.from("clubs").select("id").eq("slug", SITE_CLUB_SLUG).single();
  if (error || !data) throw new Error(`No club with slug "${SITE_CLUB_SLUG}".`);
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
