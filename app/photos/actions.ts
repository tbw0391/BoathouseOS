"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addPhoto(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const url = String(formData.get("url") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const taggedIds = formData.getAll("tagged_profile_ids").map(String).filter(Boolean);

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
