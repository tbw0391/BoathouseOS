import { createClient } from "@/lib/supabase/server";
import type { Photo, PhotoComment, PhotoLike, PhotoTag, Profile, Role } from "@/lib/database.types";
import { PhotoUploadForm } from "./PhotoUploadForm";
import { deletePhoto } from "./actions";
import { PhotoSocial } from "./PhotoSocial";
import { StorageImage } from "@/components/StorageImage";
import { clubDateKey } from "@/lib/raceDay";
import { boatsByDay } from "@/lib/photoBoats";

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

  // Boats from the last two weeks, by day, so a photo can tag a whole
  // crew at once — straight from that day's lineup, not the boat's usual crew.
  const { data: recentEvents } = await supabase
    .from("schedule_events")
    .select("id, title, starts_at")
    .gte("starts_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .lte("starts_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  const eventById = new Map(
    ((recentEvents as { id: string; title: string; starts_at: string }[] | null) ?? []).map((e) => [e.id, e])
  );
  const { data: recentLineups } = eventById.size
    ? await supabase
        .from("lineups")
        .select("id, event_id, boat_name, race_name, race_time, lineup_seats(rower_id)")
        .in("event_id", [...eventById.keys()])
    : { data: [] };
  const boatDays = boatsByDay(
    (
      (recentLineups as {
        id: string;
        event_id: string;
        boat_name: string;
        race_name: string | null;
        race_time: string | null;
        lineup_seats: { rower_id: string | null }[];
      }[] | null) ?? []
    ).map((l) => {
      const event = eventById.get(l.event_id)!;
      return {
        lineupId: l.id,
        dateKey: clubDateKey(l.race_time ?? event.starts_at),
        eventTitle: event.title,
        label: l.race_name ? `${l.boat_name} · ${l.race_name}` : l.boat_name,
        memberIds: l.lineup_seats.map((s) => s.rower_id).filter((id): id is string => !!id),
      };
    })
  );

  const { data: photosData } = await supabase
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false });
  const photos = (photosData as Photo[] | null) ?? [];

  const [{ data: tagsData }, { data: likesData }, { data: commentsData }] = await Promise.all([
    supabase.from("photo_tags").select("*"),
    supabase.from("photo_likes").select("*"),
    supabase.from("photo_comments").select("*").order("created_at", { ascending: true }),
  ]);
  const tags = (tagsData as PhotoTag[] | null) ?? [];
  const likes = (likesData as PhotoLike[] | null) ?? [];
  const comments = (commentsData as PhotoComment[] | null) ?? [];

  const nameById = new Map(roster.map((r) => [r.id, r.display_name]));
  const tagsByPhoto = new Map<string, string[]>();
  for (const tag of tags) {
    tagsByPhoto.set(tag.photo_id, [...(tagsByPhoto.get(tag.photo_id) ?? []), tag.profile_id]);
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Photos</h1>

      {user && <PhotoUploadForm userId={user.id} roster={roster} boatDays={boatDays} todayKey={clubDateKey(new Date())} />}

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
                <div className="relative w-full aspect-square">
                  <StorageImage
                    src={photo.url}
                    alt={photo.caption ?? ""}
                    fill
                    sizes="(min-width: 640px) 33vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-2 flex flex-col gap-1">
                  {photo.caption && <p className="text-sm">{photo.caption}</p>}
                  {taggedNames.length > 0 && (
                    <p className="text-xs text-gray-500">With {taggedNames.join(", ")}</p>
                  )}
                  <PhotoSocial
                    photoId={photo.id}
                    likeCount={likes.filter((l) => l.photo_id === photo.id).length}
                    likedByMe={likes.some((l) => l.photo_id === photo.id && l.profile_id === user?.id)}
                    likerNames={likes
                      .filter((l) => l.photo_id === photo.id)
                      .map((l) => nameById.get(l.profile_id))
                      .filter((n): n is string => Boolean(n))}
                    comments={comments
                      .filter((c) => c.photo_id === photo.id)
                      .map((c) => ({
                        id: c.id,
                        authorName: nameById.get(c.author_id) ?? "Someone",
                        body: c.body,
                        canDelete: isStaff || c.author_id === user?.id,
                      }))}
                  />
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
