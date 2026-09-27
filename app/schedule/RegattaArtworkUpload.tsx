"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { setRegattaArtwork } from "./actions";

// Coach/admin control on a regatta card for its logo — the artwork that goes
// in the middle of every medal badge rowers win at this regatta.
export function RegattaArtworkUpload({ eventId, artworkUrl }: { eventId: string; artworkUrl: string | null }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const busy = uploading || isPending;

  function save(url: string | null) {
    const formData = new FormData();
    formData.set("event_id", eventId);
    formData.set("artwork_url", url ?? "");
    startTransition(async () => {
      try {
        await setRegattaArtwork(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${eventId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("regatta-artwork").upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("regatta-artwork").getPublicUrl(path);
      save(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        {artworkUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artworkUrl} alt="" className="w-10 h-10 rounded object-contain border" />
        )}
        <label className="text-xs font-medium text-gray-600 hover:text-black cursor-pointer">
          {busy ? "Saving..." : artworkUrl ? "Change medal logo" : "Add medal logo"}
          <input type="file" accept="image/*" onChange={handleFile} disabled={busy} className="hidden" />
        </label>
        {artworkUrl && !busy && (
          <button
            type="button"
            onClick={() => save(null)}
            className="text-xs font-medium text-gray-500 hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
