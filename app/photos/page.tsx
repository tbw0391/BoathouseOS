import { createClient } from "@/lib/supabase/server";
import type { Photo, PhotoTag, Profile, Role } from "@/lib/database.types";
import { PhotoUploadForm } from "./PhotoUploadForm";
import { deletePhoto } from "./actions";

export default async function PhotosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();
  const callerRole = (callerProfile as { role: Role } | null)?.role;
  const isStaff = callerRole === "admin" || callerRole === "coach";

  const { data: rosterData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .is("disabled_at", null)
    .order("display_name", { ascending: true });
  const roster = (rosterData as Pick<Profile, "id" | "display_name">[] | null) ?? [];

  const { data: photosData } = await supabase
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false });
  const photos = (photosData as Photo[] | null) ?? [];

  const { data: tagsData } = await supabase.from("photo_tags").select("*");
  const tags = (tagsData as PhotoTag[] | null) ?? [];

  const nameById = new Map(roster.map((r) => [r.id, r.display_name]));
  const tagsByPhoto = new Map<string, string[]>();
  for (const tag of tags) {
    tagsByPhoto.set(tag.photo_id, [...(tagsByPhoto.get(tag.photo_id) ?? []), tag.profile_id]);
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Photos</h1>

      {user && <PhotoUploadForm userId={user.id} roster={roster} />}

      {photos.length === 0 ? (
        <p className="text-sm text-gray-500">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {photos.map((photo) => {
            const taggedNames = (tagsByPhoto.get(photo.id) ?? [])
              .map((id) => nameById.get(id))
              .filter((n): n is string => Boolean(n));
            const canDelete = isStaff || photo.uploaded_by === user?.id;

            return (
              <div key={photo.id} className="border rounded-lg overflow-hidden flex flex-col">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.caption ?? ""} className="w-full aspect-square object-cover" />
                <div className="p-2 flex flex-col gap-1">
                  {photo.caption && <p className="text-sm">{photo.caption}</p>}
                  {taggedNames.length > 0 && (
                    <p className="text-xs text-gray-500">With {taggedNames.join(", ")}</p>
                  )}
                  {canDelete && (
                    <form action={deletePhoto}>
                      <input type="hidden" name="photo_id" value={photo.id} />
                      <button type="submit" className="text-xs text-red-600 hover:text-red-700">
                        Delete
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
