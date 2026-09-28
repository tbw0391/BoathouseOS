"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";

export async function addPhoto(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const url = String(formData.get("url") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const taggedIds = [...new Set(formData.getAll("tagged_profile_ids").map(String).filter(Boolean))];

  if (!url) throw new Error("Missing photo.");

  const { data: photo, error } = await supabase
    .from("photos")
    .insert({ url, caption, uploaded_by: user.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (taggedIds.length > 0) {
    const rows = taggedIds.map((profile_id) => ({
      photo_id: (photo as { id: string }).id,
      profile_id,
      tagged_by: user.id,
    }));
    const { error: tagError } = await supabase.from("photo_tags").insert(rows);
    if (tagError) throw new Error(tagError.message);
  }

  revalidatePath("/photos");
  revalidatePath("/roster/[id]", "page");
}

export async function deletePhoto(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const photoId = String(formData.get("photo_id") ?? "").trim();
  if (!photoId) throw new Error("Missing photo.");

  const { error } = await supabase.from("photos").delete().eq("id", photoId);
  if (error) throw new Error(error.message);

  revalidatePath("/photos");
  revalidatePath("/roster/[id]", "page");
}

export async function setPhotoLiked(photoId: string, liked: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = liked
    ? await supabase
        .from("photo_likes")
        .upsert({ photo_id: photoId, profile_id: user.id }, { onConflict: "photo_id,profile_id", ignoreDuplicates: true })
    : await supabase.from("photo_likes").delete().eq("photo_id", photoId).eq("profile_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/photos");
}

export async function addPhotoComment(photoId: string, text: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const body = text.trim();
  if (!body) return;
  if (body.length > 500) throw new Error("Keep comments under 500 characters.");

  const { error } = await supabase
    .from("photo_comments")
    .insert({ photo_id: photoId, author_id: user.id, body });
  if (error) throw new Error(error.message);

  revalidatePath("/photos");

  // Let the person who posted the photo know.
  after(async () => {
    const [{ data: photo }, { data: author }] = await Promise.all([
      supabase.from("photos").select("uploaded_by").eq("id", photoId).single(),
      supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    ]);
    const uploader = (photo as { uploaded_by: string | null } | null)?.uploaded_by;
    if (!uploader || uploader === user.id) return;
    await sendPush([uploader], {
      kind: "photo_comment",
      title: `${(author as { display_name: string } | null)?.display_name ?? "Someone"} commented on your photo`,
      body: body.length > 140 ? `${body.slice(0, 139)}…` : body,
      url: "/photos",
      tag: `photo-${photoId}`,
    });
  });
}

export async function deletePhotoComment(commentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  // RLS limits this to the author or a coach/admin.
  const { error } = await supabase.from("photo_comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);

  revalidatePath("/photos");
}
