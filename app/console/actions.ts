"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UserError, tryAction } from "@/lib/userError";
import { CLUB_HOST_SUFFIX, IS_DEMO_SITE, RECRUIT_URL, RESERVED_SLUGS } from "@/lib/site";
import { ROLES, allAuthUsers, requireGlobalAdmin, temporaryPassword } from "@/lib/console";
import { saveClubAppBranding } from "@/lib/clubIcon";
import { DEFAULT_THEME_COLORS, isHexColor, type ThemeColorKey } from "@/lib/theme";
import { sendPush } from "@/lib/push";
import { emailConfigured, sendEmails } from "@/lib/email";
import { isDemoEmail } from "@/lib/demoAccount";

// --- Demo (the demo site only) ---

// The database functions check global-admin status themselves (see
// migration 0058), so these just call through.
export async function saveDemoBaseline() {
  if (!IS_DEMO_SITE) throw new UserError("There's no demo on this site.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("demo_save_baseline");
  if (error) throw new Error(error.message);
  revalidatePath("/console");
}

export async function resetDemo(formData: FormData) {
  return tryAction(async () => {
    if (!IS_DEMO_SITE) throw new UserError("There's no demo on this site.");
    if (formData.get("confirm") !== "on") {
      throw new UserError("Tick the confirmation box to reset the demo.");
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("demo_reset");
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
  });
}

// Pretend boats on Hoover Reservoir for showing off live tracking (0125).
export async function startBoatSim(formData: FormData) {
  return tryAction(async () => {
    if (!IS_DEMO_SITE) throw new UserError("The boat simulator is only on the demo site.");
    const supabase = await createClient();
    const { error } = await supabase.rpc("on_water_sim_start", {
      p_club_id: String(formData.get("clubId") ?? ""),
      p_boats: Number(formData.get("boats") ?? 5),
      p_minutes: Number(formData.get("minutes") ?? 30),
    });
    if (error) throw new UserError(error.message);
    revalidatePath("/console");
  });
}

export async function stopBoatSim(formData: FormData) {
  return tryAction(async () => {
    if (!IS_DEMO_SITE) throw new UserError("The boat simulator is only on the demo site.");
    const supabase = await createClient();
    const { error } = await supabase.rpc("on_water_sim_stop", { p_club_id: String(formData.get("clubId") ?? "") });
    if (error) throw new UserError(error.message);
    revalidatePath("/console");
  });
}

// --- Errors (0100: no update policy, so written with the service role) ---

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
    revalidatePath("/console", "layout");
  });
}

export async function clearFixedErrors() {
  await requireGlobalAdmin();
  const { error } = await createAdminClient().from("error_reports").delete().not("resolved_at", "is", null);
  if (error) throw new Error(error.message);
  revalidatePath("/console", "layout");
}

// --- App suggestions (0116: club admins only see "club" ones) ---

export async function setAppSuggestionStatus(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const id = String(formData.get("id") ?? "");
    const status = formData.get("status") === "reviewed" ? "reviewed" : "new";
    const { error } = await createAdminClient()
      .from("suggestions")
      .update({ status })
      .eq("id", id)
      .eq("category", "app");
    if (error) throw new Error(error.message);
    revalidatePath("/console", "layout");
  });
}

export async function deleteAppSuggestion(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const { error } = await createAdminClient()
      .from("suggestions")
      .delete()
      .eq("id", String(formData.get("id") ?? ""))
      .eq("category", "app");
    if (error) throw new Error(error.message);
    revalidatePath("/console", "layout");
  });
}

// --- Clubs ---

function slugFor(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "club"
  );
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
    const taken = new Set([...RESERVED_SLUGS, ...((slugRows as { slug: string }[] | null) ?? []).map((r) => r.slug)]);
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

    revalidatePath("/console", "layout");
    return { clubName: name, email, password, slug };
  });
}

async function clubOrThrow(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await admin.from("clubs").select("id, name, slug").eq("id", id).maybeSingle();
  const club = data as { id: string; name: string; slug: string } | null;
  if (!club) throw new UserError("That club wasn't found.");
  return club;
}

// Name and address. A new address also needs its DNS record and Vercel
// domain (the page says so).
export async function updateClub(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const admin = createAdminClient();
    const club = await clubOrThrow(admin, String(formData.get("id") ?? ""));
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    if (!name) throw new UserError("Give the club a name.");
    if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) {
      throw new UserError("The address can only have lowercase letters, numbers and dashes (not at the ends).");
    }
    if (RESERVED_SLUGS.includes(slug)) throw new UserError(`"${slug}" is reserved. Pick another address.`);
    if (slug !== club.slug) {
      const { data: taken } = await admin.from("clubs").select("id").eq("slug", slug).maybeSingle();
      if (taken) throw new UserError("Another club already has that address.");
    }
    const { error } = await admin.from("clubs").update({ name, slug }).eq("id", club.id);
    if (error) throw new Error(error.message);
    revalidatePath("/console", "layout");
  });
}

export async function updateClubColors(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const admin = createAdminClient();
    const club = await clubOrThrow(admin, String(formData.get("id") ?? ""));
    const colors: Record<ThemeColorKey, string> = { ...DEFAULT_THEME_COLORS };
    if (formData.get("reset") !== "on") {
      for (const key of Object.keys(DEFAULT_THEME_COLORS) as ThemeColorKey[]) {
        const raw = formData.get(`color:${key}`);
        if (isHexColor(raw)) colors[key] = raw;
      }
    }
    const { error } = await admin
      .from("club_settings")
      .upsert({ club_id: club.id, key: "theme_colors", value: JSON.stringify(colors) }, { onConflict: "club_id,key" });
    if (error) throw new Error(error.message);
    revalidatePath("/console", "layout");
  });
}

export async function updateClubBranding(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const admin = createAdminClient();
    const club = await clubOrThrow(admin, String(formData.get("id") ?? ""));
    await saveClubAppBranding(club.id, formData);
    revalidatePath("/console", "layout");
  });
}

// Suspended clubs' members are locked out (is_approved(), 0107) until it's
// lifted. Nothing is deleted.
export async function setClubSuspended(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const admin = createAdminClient();
    const club = await clubOrThrow(admin, String(formData.get("id") ?? ""));
    const suspend = formData.get("suspend") === "1";
    if (suspend && formData.get("confirm") !== "on") {
      throw new UserError("Tick the box to confirm locking out everyone in this club.");
    }
    const { error } = await admin
      .from("clubs")
      .update({ suspended_at: suspend ? new Date().toISOString() : null })
      .eq("id", club.id);
    if (error) throw new Error(error.message);
    revalidatePath("/console", "layout");
  });
}

// Only a club with nobody in it (e.g. one made by mistake): anything else
// gets suspended instead, so no one's data is lost.
export async function deleteClub(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const admin = createAdminClient();
    const club = await clubOrThrow(admin, String(formData.get("id") ?? ""));
    if (String(formData.get("confirm_name") ?? "").trim() !== club.name) {
      throw new UserError(`Type the club's name exactly (${club.name}) to delete it.`);
    }
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("club_id", club.id);
    if ((count ?? 0) > 0) {
      throw new UserError("This club still has members. Suspend it instead, or remove its members first.");
    }
    for (const table of ["chat_groups", "task_types", "payment_settings", "club_settings", "platform_notices"]) {
      await admin.from(table).delete().eq("club_id", club.id);
    }
    await admin.storage.from("club-icons").remove([`${club.id}/icon.png`]);
    const { error } = await admin.from("clubs").delete().eq("id", club.id);
    if (error) {
      throw new UserError(`The club still has data (${error.message}). Suspend it instead.`);
    }
    revalidatePath("/console", "layout");
  });
}

// --- Members ---

async function memberOrThrow(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await admin.from("profiles").select("id, email, display_name, role").eq("id", id).maybeSingle();
  const person = data as { id: string; email: string | null; display_name: string; role: string } | null;
  if (!person) throw new UserError("That member wasn't found.");
  return person;
}

// A fresh temporary password to pass on (they change it from their profile,
// or use Forgot password).
export async function newMemberPassword(profileId: string) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const admin = createAdminClient();
    const person = await memberOrThrow(admin, profileId);
    if (!person.email) throw new UserError("They don't have a login (no email on their profile).");
    const password = temporaryPassword();
    const { error } = await admin.auth.admin.updateUserById(profileId, { password });
    if (error) {
      if (error.message.toLowerCase().includes("not found")) throw new UserError("They don't have a login yet.");
      throw new Error(error.message);
    }
    return { email: person.email, password };
  });
}

export async function setMemberRole(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const admin = createAdminClient();
    const person = await memberOrThrow(admin, String(formData.get("id") ?? ""));
    const role = String(formData.get("role") ?? "");
    if (!(ROLES as readonly string[]).includes(role)) throw new UserError("Pick a role.");
    const { error } = await admin.from("profiles").update({ role }).eq("id", person.id);
    if (error) throw new Error(error.message);
    revalidatePath("/console", "layout");
  });
}

// approve | remove | restore
export async function setMemberStatus(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const admin = createAdminClient();
    const person = await memberOrThrow(admin, String(formData.get("id") ?? ""));
    const now = new Date().toISOString();
    const change = String(formData.get("change") ?? "");
    const update =
      change === "approve"
        ? { approved_at: now, disabled_at: null }
        : change === "remove"
          ? { disabled_at: now }
          : change === "restore"
            ? { disabled_at: null }
            : null;
    if (!update) throw new UserError("Unknown change.");
    const { error } = await admin.from("profiles").update(update).eq("id", person.id);
    if (error) throw new Error(error.message);
    revalidatePath("/console", "layout");
  });
}

// --- Announcements (platform notices, 0107) ---

export async function createNotice(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const admin = createAdminClient();
    const title = String(formData.get("title") ?? "").trim().slice(0, 120);
    const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
    const audience = formData.get("audience") === "everyone" ? "everyone" : "admins";
    const clubId = String(formData.get("club_id") ?? "") || null;
    const days = Number(formData.get("days") ?? 0);
    if (!title || !body) throw new UserError("Give the announcement a title and a message.");
    if (clubId) await clubOrThrow(admin, clubId);

    const { error } = await admin.from("platform_notices").insert({
      title,
      body,
      audience,
      club_id: clubId,
      expires_at: days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null,
    });
    if (error) throw new Error(error.message);

    // Who it's for, to alert them now too.
    let q = admin
      .from("profiles")
      .select("id, email, club_id, clubs!inner(slug, suspended_at)")
      .not("approved_at", "is", null)
      .is("disabled_at", null)
      .is("clubs.suspended_at", null);
    if (clubId) q = q.eq("club_id", clubId);
    if (audience === "admins") q = q.eq("role", "admin");
    const { data: people } = await q;
    const recipients =
      (people as unknown as { id: string; email: string | null; clubs: { slug: string } }[] | null) ?? [];

    let pushed = 0;
    let emailed = 0;
    if (formData.get("push") === "on" && recipients.length) {
      await sendPush(
        recipients.map((p) => p.id),
        { kind: "announcement", title, body: body.slice(0, 180), url: "/" }
      );
      pushed = recipients.length;
    }
    if (formData.get("email") === "on" && recipients.length) {
      if (!emailConfigured()) throw new UserError("The announcement is posted, but email isn't set up on this site.");
      // Each club's members get a link to their own club's address.
      const bySlug = new Map<string, Set<string>>();
      for (const p of recipients) {
        const email = p.email?.trim();
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || isDemoEmail(email)) continue;
        if (!bySlug.has(p.clubs.slug)) bySlug.set(p.clubs.slug, new Set());
        bySlug.get(p.clubs.slug)!.add(email);
      }
      for (const [slug, emails] of bySlug) {
        const link = IS_DEMO_SITE
          ? (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.boathouseos.app")
          : `https://${slug}${CLUB_HOST_SUFFIX}`;
        const { html, text } = noticeEmail(title, body, link);
        await sendEmails([...emails], `BoathouseOS: ${title}`, html, text);
        emailed += emails.size;
      }
    }

    revalidatePath("/console", "layout");
    return { recipients: recipients.length, pushed, emailed };
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function noticeEmail(title: string, body: string, link: string) {
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px">
<p style="margin:0 0 4px;color:#6b7280;font-size:13px">From BoathouseOS</p>
<h2 style="margin:0 0 8px">${escapeHtml(title)}</h2>
<p style="margin:0 0 16px;white-space:pre-line">${escapeHtml(body)}</p>
<p style="margin:0"><a href="${escapeHtml(link)}" style="background:#1f2937;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open your club's app</a></p>
</div>`;
  const text = `From BoathouseOS\n\n${title}\n\n${body}\n\n${link}`;
  return { html, text };
}

export async function deleteNotice(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const { error } = await createAdminClient()
      .from("platform_notices")
      .delete()
      .eq("id", String(formData.get("id") ?? ""));
    if (error) throw new Error(error.message);
    revalidatePath("/console", "layout");
  });
}

// --- Global admins ---

// Adds an existing sign-in account, or makes a new one with no club and no
// usable password: they set theirs with "Forgot password?" on the console's
// sign-in page.
export async function addGlobalAdmin(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const admin = createAdminClient();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new UserError("That email doesn't look right.");

    const existing = (await allAuthUsers(admin)).find((u) => u.email?.toLowerCase() === email);
    let userId = existing?.id;
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: temporaryPassword() + temporaryPassword(),
        email_confirm: true,
      });
      if (error || !data.user) throw new Error(error?.message ?? "Couldn't create the account.");
      userId = data.user.id;
    }
    const { error } = await admin.from("global_admins").upsert({ user_id: userId }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    revalidatePath("/console", "layout");
    return { email, created: !existing };
  });
}

export async function removeGlobalAdmin(formData: FormData) {
  return tryAction(async () => {
    const me = await requireGlobalAdmin();
    const admin = createAdminClient();
    const userId = String(formData.get("user_id") ?? "");
    if (userId === me.id) throw new UserError("You can't remove yourself. Sign in as another global admin to do that.");
    const { count } = await admin.from("global_admins").select("user_id", { count: "exact", head: true });
    if ((count ?? 0) <= 1) throw new UserError("There has to be at least one global admin.");
    const { error } = await admin.from("global_admins").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/console", "layout");
  });
}

// --- College coaches (0121) ---

// Approve or turn down a college coach. Approving emails them.
export async function setRecruiterStatus(formData: FormData) {
  return tryAction(async () => {
    await requireGlobalAdmin();
    const admin = createAdminClient();
    const userId = String(formData.get("user_id") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!["approved", "rejected", "pending"].includes(status)) throw new UserError("Unknown status.");
    const { data, error } = await admin
      .from("recruiters")
      .update({ status, decided_at: status === "pending" ? null : new Date().toISOString() })
      .eq("user_id", userId)
      .select("email, name")
      .single();
    if (error) throw new Error(error.message);
    const r = data as { email: string; name: string };
    if (status === "approved" && emailConfigured()) {
      await sendEmails(
        [r.email],
        "You can now see athletes on BoathouseOS",
        `<p>Hi ${escapeHtml(r.name)},</p><p>Your college coach account is approved. Sign in to see the rowers and coxswains listed for college coaches.</p><p><a href="${escapeHtml(RECRUIT_URL)}">${escapeHtml(RECRUIT_URL)}</a></p>`,
        `Hi ${r.name},\n\nYour college coach account is approved. Sign in to see the rowers and coxswains listed for college coaches:\n\n${RECRUIT_URL}`
      );
    }
    revalidatePath("/console", "layout");
  });
}
