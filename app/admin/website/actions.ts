"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserError, tryAction } from "@/lib/userError";
import { WEBSITE_KEY, WEBSITE_SECTIONS, parseWebsiteSettings, slugify } from "@/lib/website";

// Admin Settings > Website (0112). Admins only; the database checks too.

async function requireAdmin() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_club_admin");
  if (!isAdmin) throw new UserError("Only admins can change the club website.");
  const { data: clubId } = await supabase.rpc("current_club_id");
  if (!clubId) throw new UserError("Couldn't tell which club you're in.");
  return { supabase, clubId: clubId as string };
}

function refresh() {
  revalidatePath("/admin/website", "layout");
  revalidatePath("/site", "layout");
}

async function currentSettings(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("club_settings").select("value").eq("key", WEBSITE_KEY).maybeSingle();
  return parseWebsiteSettings((data as { value: string | null } | null)?.value);
}

export async function saveWebsiteSettings(formData: FormData) {
  return tryAction(async () => {
    const { supabase, clubId } = await requireAdmin();
    const settings = await currentSettings(supabase);
    settings.enabled = formData.get("enabled") === "on";
    settings.tagline = String(formData.get("tagline") ?? "").trim().slice(0, 160);
    settings.about = String(formData.get("about") ?? "").trim().slice(0, 5000);
    settings.joinText = String(formData.get("join_text") ?? "").trim().slice(0, 3000);
    for (const s of WEBSITE_SECTIONS) settings.sections[s.key] = formData.get(`section:${s.key}`) === "on";

    const photo = formData.get("hero");
    if (photo instanceof File && photo.size > 0) {
      if (photo.size > 8 * 1024 * 1024) throw new UserError("That photo is too big (8MB at most).");
      const { default: sharp } = await import("sharp");
      let jpg: Buffer;
      try {
        jpg = await sharp(Buffer.from(await photo.arrayBuffer()))
          .rotate()
          .resize(2000, 900, { fit: "cover" })
          .jpeg({ quality: 82 })
          .toBuffer();
      } catch {
        throw new UserError("That file isn't a photo we can use. Try a JPG or PNG.");
      }
      const path = `${clubId}/website-hero-${Date.now()}.jpg`;
      const admin = createAdminClient();
      const { error } = await admin.storage.from("club-icons").upload(path, jpg, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      if (settings.heroPath) await admin.storage.from("club-icons").remove([settings.heroPath]);
      settings.heroPath = path;
    }
    if (formData.get("remove_hero") === "on" && settings.heroPath) {
      await createAdminClient().storage.from("club-icons").remove([settings.heroPath]);
      settings.heroPath = null;
    }

    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: WEBSITE_KEY, value: JSON.stringify(settings) }, { onConflict: "club_id,key" });
    if (error) throw new Error(error.message);
    refresh();
  });
}

// Photos and documents for pages go in the public "website" bucket (0113).
export async function uploadWebsiteFile(formData: FormData) {
  return tryAction(async () => {
    const { clubId } = await requireAdmin();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Pick a file.");
    if (file.size > 50 * 1024 * 1024) throw new UserError("That file is too big (50MB at most).");
    const name = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80) || "file";
    const path = `${clubId}/uploads/${Date.now()}-${name}`;
    const admin = createAdminClient();
    const { error } = await admin.storage.from("website").upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "application/octet-stream",
    });
    if (error) throw new Error(error.message);
    const url = admin.storage.from("website").getPublicUrl(path).data.publicUrl;
    return { url, isImage: (file.type || "").startsWith("image/") };
  });
}

// A new page or news post (unpublished until the admin publishes it).
export async function createWebsitePage(formData: FormData) {
  return tryAction(async () => {
    const { supabase } = await requireAdmin();
    const title = String(formData.get("title") ?? "").trim().slice(0, 120);
    const kind = formData.get("kind") === "news" ? "news" : "page";
    if (!title) throw new UserError("Give it a title.");
    const { data: existing } = await supabase.from("website_pages").select("slug");
    const taken = new Set(((existing as { slug: string }[] | null) ?? []).map((r) => r.slug));
    const base = slugify(title);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const { data, error } = await supabase.from("website_pages").insert({ title, kind, slug }).select("id").single();
    if (error) throw new Error(error.message);
    refresh();
    return { id: (data as { id: string }).id };
  });
}

export async function saveWebsitePage(formData: FormData) {
  return tryAction(async () => {
    const { supabase } = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const title = String(formData.get("title") ?? "").trim().slice(0, 120);
    if (!title) throw new UserError("Give it a title.");
    const { error } = await supabase
      .from("website_pages")
      .update({
        title,
        body: String(formData.get("body") ?? "").slice(0, 20000),
        published: formData.get("published") === "on",
        sort_order: Number(formData.get("sort_order") ?? 0) || 0,
        menu_group: String(formData.get("menu_group") ?? "").trim().slice(0, 40) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function deleteWebsitePage(formData: FormData) {
  return tryAction(async () => {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("website_pages").delete().eq("id", String(formData.get("id") ?? ""));
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function markInquiryHandled(formData: FormData) {
  return tryAction(async () => {
    const { supabase } = await requireAdmin();
    const handled = formData.get("handled") === "1";
    const { error } = await supabase
      .from("website_inquiries")
      .update({ handled_at: handled ? new Date().toISOString() : null })
      .eq("id", String(formData.get("id") ?? ""));
    if (error) throw new Error(error.message);
    refresh();
  });
}
