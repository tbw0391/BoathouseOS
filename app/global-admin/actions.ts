"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UserError, tryAction } from "@/lib/userError";

// The database functions check global-admin status themselves (see
// migration 0058), so these just call through.
export async function saveDemoBaseline() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("demo_save_baseline");
  if (error) throw new Error(error.message);
  revalidatePath("/global-admin");
}

export async function resetDemo(formData: FormData) {
  return tryAction(async () => {
    if (formData.get("confirm") !== "on") {
      throw new UserError("Tick the confirmation box to reset the demo.");
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("demo_reset");
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
  });
}

// Error reports (0100) have no update policy, so these check global-admin
// status here and write with the service role.
async function requireGlobalAdmin() {
  const supabase = await createClient();
  const { data: isGlobalAdmin } = await supabase.rpc("is_global_admin");
  if (!isGlobalAdmin) throw new UserError("Only a global admin can do that.");
}

export async function markErrorFixed(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) throw new UserError("Missing error.");
    const { error } = await createAdminClient()
      .from("error_reports")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/global-admin/errors");
  });
}

export async function clearFixedErrors() {
  await requireGlobalAdmin();
  const { error } = await createAdminClient().from("error_reports").delete().not("resolved_at", "is", null);
  if (error) throw new Error(error.message);
  revalidatePath("/global-admin/errors");
}

// --- Clubs (/global-admin/clubs) ---

function slugFor(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "club"
  );
}

// Readable, no look-alike characters (0/O, 1/l).
function temporaryPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

// Undoes a club that was just made and has no members yet.
async function removeNewClub(admin: ReturnType<typeof createAdminClient>, clubId: string) {
  for (const table of ["chat_groups", "task_types", "payment_settings"]) {
    await admin.from(table).delete().eq("club_id", clubId);
  }
  await admin.from("clubs").delete().eq("id", clubId);
}

// A new club (it comes with its team chats, board chat, task types and
// payment settings; see 0104) and its first admin, whose login gets a
// temporary password to pass on.
export async function createClub(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!name || !firstName || !lastName || !email) {
      throw new UserError("Club name, and the admin's first name, last name and email are all needed.");
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new UserError("That email doesn't look right.");

    const admin = createAdminClient();
    const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    // One club per account.
    if (existing) throw new UserError("Someone with that email already has an account.");

    const { data: slugRows } = await admin.from("clubs").select("slug");
    const taken = new Set(((slugRows as { slug: string }[] | null) ?? []).map((r) => r.slug));
    const base = slugFor(name);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

    const { data: club, error: clubError } = await admin.from("clubs").insert({ name, slug }).select("id").single();
    if (clubError || !club) throw new Error(clubError?.message ?? "Couldn't create the club.");
    const clubId = (club as { id: string }).id;

    const password = temporaryPassword();
    const { data: created, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userError || !created.user) {
      await removeNewClub(admin, clubId);
      if (userError?.message?.toLowerCase().includes("already")) {
        throw new UserError("Someone with that email already has an account.");
      }
      throw new Error(userError?.message ?? "Couldn't create the admin's login.");
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      club_id: clubId,
      email,
      first_name: firstName,
      last_name: lastName,
      display_name: `${firstName} ${lastName}`,
      role: "admin",
      approved_at: new Date().toISOString(),
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      await removeNewClub(admin, clubId);
      throw new Error(profileError.message);
    }

    revalidatePath("/global-admin/clubs");
    return { clubName: name, email, password };
  });
}

// A fresh temporary password for one of a club's admins (e.g. the first
// one lost theirs before signing in).
export async function newAdminPassword(profileId: string) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("email, role").eq("id", profileId).maybeSingle();
    const person = data as { email: string; role: string } | null;
    if (!person || person.role !== "admin") throw new UserError("That admin wasn't found.");
    const password = temporaryPassword();
    const { error } = await admin.auth.admin.updateUserById(profileId, { password });
    if (error) throw new Error(error.message);
    return { email: person.email, password };
  });
}
