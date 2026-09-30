import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserError } from "@/lib/userError";

// The global admin console. Global admins, like everyone, only see their own
// club through the database (the console's own account has no club at all),
// so the console reads and writes with the service role once it has checked
// who's asking.

export type Admin = ReturnType<typeof createAdminClient>;

// For console pages: the signed-in global admin, or null (the page then
// shows NotGlobalAdmin).
export async function consoleUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isGlobalAdmin } = await supabase.rpc("is_global_admin");
  return isGlobalAdmin ? { id: user.id, email: user.email ?? null } : null;
}

// For console actions.
export async function requireGlobalAdmin(): Promise<{ id: string; email: string | null }> {
  const me = await consoleUser();
  if (!me) throw new UserError("Only a global admin can do that.");
  return me;
}

// Readable, no look-alike characters (0/O, 1/l).
export function temporaryPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

// Every sign-in account, for last-sign-in times and emails of accounts
// without a profile (the console's own).
export async function allAuthUsers(admin: Admin) {
  const users: { id: string; email: string | null; last_sign_in_at: string | null; created_at: string }[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    users.push(
      ...data.users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
      }))
    );
    if (data.users.length < 1000) break;
  }
  return users;
}

export const ROLES = ["rower", "coxswain", "coach", "parent", "admin"] as const;

export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
