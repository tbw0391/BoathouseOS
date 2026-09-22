import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";

export default async function WalkUpSongsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, display_name, walk_up_song")
    .is("disabled_at", null)
    .not("walk_up_song", "is", null)
    .order("display_name", { ascending: true });
  const profiles =
    (profilesData as Pick<Profile, "id" | "display_name" | "walk_up_song">[] | null) ?? [];

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-2">Walk Up Songs</h1>
      <p className="text-sm text-gray-500 mb-6">
        Set yours from your bio&apos;s &quot;Walk up song&quot; field.
      </p>

      {profiles.length === 0 && (
        <p className="text-sm text-gray-500">No one has picked a walk up song yet.</p>
      )}

      {profiles.length > 0 && (
        <div className="flex flex-col gap-3 max-w-md">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 border rounded-lg px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{p.display_name}</p>
                <p className="text-gray-500 truncate">{p.walk_up_song}</p>
              </div>
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                  p.walk_up_song ?? ""
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 hover:bg-[var(--color-primary)] transition-colors"
              >
                Search
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
