"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmails } from "@/lib/email";
import { consolePageUrl, globalAdminEmails } from "@/lib/globalAdmins";
import type { SuggestionCategory } from "@/lib/database.types";
import { UserError, tryAction } from "@/lib/userError";

const VALID_CATEGORIES: SuggestionCategory[] = ["club", "app"];

export async function submitSuggestion(formData: FormData) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const body = String(formData.get("body") ?? "").trim();
    if (!body) throw new UserError("Write your suggestion first.");

    const category = String(formData.get("category") ?? "");
    if (!VALID_CATEGORIES.includes(category as SuggestionCategory)) {
      throw new UserError("Please choose whether this is about the club or the app.");
    }

    const { error } = await supabase
      .from("suggestions")
      .insert({ submitted_by: user.id, body, category });

    if (error) throw new Error(error.message);

    // App suggestions go to BoathouseOS's global admins (0116).
    if (category === "app") after(() => emailAppSuggestion(user.id, body));

    revalidatePath("/suggestions");
  });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function emailAppSuggestion(senderId: string, body: string) {
  const admin = createAdminClient();
  const [emails, { data }] = await Promise.all([
    globalAdminEmails(admin),
    admin.from("profiles").select("display_name, club_id").eq("id", senderId).single(),
  ]);
  if (emails.length === 0) return;
  const sender = data as { display_name: string; club_id: string } | null;
  const { data: club } = sender
    ? await admin.from("clubs").select("name").eq("id", sender.club_id).single()
    : { data: null };
  const clubName = (club as { name: string } | null)?.name;
  const from = `${sender?.display_name ?? "Someone"}${clubName ? `, ${clubName}` : ""}`;
  const link = consolePageUrl("/console/suggestions");
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px">
<p style="margin:0 0 4px;color:#6b7280;font-size:13px">App suggestion from ${escapeHtml(from)}</p>
<p style="margin:0 0 16px;font-size:15px;white-space:pre-line">${escapeHtml(body)}</p>
<p style="margin:0 0 16px"><a href="${escapeHtml(link)}" style="background:#1f2937;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">See all app suggestions</a></p>
<p style="color:#6b7280;font-size:12px;margin:0">You get these because you're a BoathouseOS global admin.</p>
</div>`;
  await sendEmails(emails, `App suggestion from ${from}`, html, `App suggestion from ${from}\n\n${body}\n\n${link}`);
}

// Club suggestions: admins, coaches and board members review them; only
// admins delete (0116).
async function requireReviewer(supabase: Awaited<ReturnType<typeof createClient>>, adminOnly = false) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, is_board_member")
    .eq("id", user.id)
    .single();

  const caller = callerProfile as { role: string; is_board_member: boolean } | null;
  const isAdmin = caller?.role === "admin";
  if (adminOnly ? !isAdmin : !(isAdmin || caller?.role === "coach" || caller?.is_board_member)) {
    throw new UserError(adminOnly ? "Only admins can delete suggestions." : "Only admins, coaches and board members can do that.");
  }
}

export async function markReviewed(suggestionId: string, reviewed: boolean) {
  const supabase = await createClient();
  await requireReviewer(supabase);

  const { error } = await supabase
    .from("suggestions")
    .update({ status: reviewed ? "reviewed" : "new" })
    .eq("id", suggestionId);

  if (error) throw new Error(error.message);

  revalidatePath("/suggestions");
}

export async function deleteSuggestion(suggestionId: string) {
  const supabase = await createClient();
  await requireReviewer(supabase, true);

  const { error } = await supabase.from("suggestions").delete().eq("id", suggestionId);
  if (error) throw new Error(error.message);

  revalidatePath("/suggestions");
}
