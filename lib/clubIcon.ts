import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserError } from "@/lib/userError";

// A club's app name and home-screen icon (0106), from the club's Admin page
// or the console. The icon is made square, 512px, on white (phones fill
// transparent corners with black) and kept in the private club-icons bucket.
export async function saveClubAppBranding(clubId: string, formData: FormData) {
  const appName = String(formData.get("app_name") ?? "").trim().slice(0, 40);
  const shortName = String(formData.get("app_short_name") ?? "").trim().slice(0, 12);
  const update: Record<string, string | null> = { app_name: appName || null, app_short_name: shortName || null };

  const file = formData.get("icon");
  if (file instanceof File && file.size > 0) {
    if (file.size > 4 * 1024 * 1024) throw new UserError("That image is too big (4MB at most).");
    const { default: sharp } = await import("sharp");
    let png: Buffer;
    try {
      png = await sharp(Buffer.from(await file.arrayBuffer()))
        .rotate()
        .resize(512, 512, { fit: "contain", background: "#ffffff" })
        .flatten({ background: "#ffffff" })
        .png()
        .toBuffer();
    } catch {
      throw new UserError("That file isn't an image we can use. Try a PNG or JPG.");
    }
    const path = `${clubId}/icon.png`;
    const { error } = await createAdminClient()
      .storage.from("club-icons")
      .upload(path, png, { contentType: "image/png", upsert: true });
    if (error) throw new Error(error.message);
    update.icon_path = path;
    update.icon_updated_at = new Date().toISOString();
  }

  const { error } = await createAdminClient().from("clubs").update(update).eq("id", clubId);
  if (error) throw new Error(error.message);
}
