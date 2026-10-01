import "server-only";
import { CONSOLE_HOST, IS_DEMO_SITE } from "@/lib/site";
import type { createAdminClient } from "@/lib/supabase/admin";

// Global admins' email addresses, from their sign-in accounts (the
// console's own account has no profile).
export async function globalAdminEmails(admin: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data: ids } = await admin.from("global_admins").select("user_id");
  const userIds = ((ids as { user_id: string }[] | null) ?? []).map((g) => g.user_id);
  const found = await Promise.all(userIds.map((id) => admin.auth.admin.getUserById(id)));
  return found.map((r) => r.data.user?.email?.trim()).filter((e): e is string => !!e);
}

// A full link to a console page, for emails.
export function consolePageUrl(path: string): string {
  return IS_DEMO_SITE
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.boathouseos.app"}${path}`
    : `https://${CONSOLE_HOST}${path}`;
}
