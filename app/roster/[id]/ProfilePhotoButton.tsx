"use client";

import { unwrap } from "@/lib/userError";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setProfilePhoto } from "./actions";

// "Add photo" / "Change photo" under the picture on a profile: opens the
// camera or photo library and saves straight away.
export function ProfilePhotoButton({ profileId, hasPhoto }: { profileId: string; hasPhoto: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      // A new path each time, as in the Edit form (a plain insert).
      const path = `${profileId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      unwrap(await setProfilePhoto(profileId, `${data.publicUrl}?t=${Date.now()}`));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <input ref={fileRef} type="file" accept="image/*" onChange={upload} className="sr-only" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-white px-3 py-1.5 text-sm font-medium disabled:opacity-60"
      >
        <Camera className="w-4 h-4" aria-hidden />
        {busy ? "Uploading..." : hasPhoto ? "Change photo" : "Add photo"}
      </button>
      {error && <p className="text-xs text-red-600 max-w-40 text-center">{error}</p>}
    </div>
  );
}
