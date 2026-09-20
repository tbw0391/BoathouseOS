"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/database.types";
import { updateBio } from "./actions";
import { TEAM_LABELS, TEAM_OPTIONS } from "@/lib/teams";

export function BioForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState(profile.photo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${profile.id}/photo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setPhotoUrl(`${data.publicUrl}?t=${Date.now()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("photo_url", photoUrl);
    startTransition(async () => {
      try {
        await updateBio(profile.id, formData);
        router.push(`/roster/${profile.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 max-w-md">
      <div className="flex items-center gap-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            className="w-32 h-32 rounded-full object-cover border"
          />
        ) : (
          <div className="w-32 h-32 rounded-full border flex items-center justify-center text-xs text-gray-400">
            No photo
          </div>
        )}
        <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-sm" />
      </div>
      {uploading && <p className="text-sm text-gray-500">Uploading photo...</p>}

      <label className="text-sm font-medium">First name</label>
      <input
        name="first_name"
        defaultValue={profile.first_name ?? ""}
        required
        className="border rounded px-3 py-2 text-sm"
      />

      <label className="text-sm font-medium">Last name</label>
      <input
        name="last_name"
        defaultValue={profile.last_name ?? ""}
        required
        className="border rounded px-3 py-2 text-sm"
      />

      <label className="text-sm font-medium">Address</label>
      <input
        name="address"
        defaultValue={profile.address ?? ""}
        className="border rounded px-3 py-2 text-sm"
      />

      <label className="text-sm font-medium">Phone number</label>
      <input
        name="phone"
        defaultValue={profile.phone ?? ""}
        className="border rounded px-3 py-2 text-sm"
      />

      <label className="text-sm font-medium">Email</label>
      <input
        value={profile.email}
        disabled
        className="border rounded px-3 py-2 text-sm bg-gray-100 text-gray-500"
      />

      <label className="text-sm font-medium">Birthday</label>
      <input
        type="date"
        name="birthday"
        defaultValue={profile.birthday ?? ""}
        className="border rounded px-3 py-2 text-sm"
      />

      <label className="text-sm font-medium">High school</label>
      <input
        name="high_school"
        defaultValue={profile.high_school ?? ""}
        className="border rounded px-3 py-2 text-sm"
      />

      <label className="text-sm font-medium">Graduation year</label>
      <input
        name="grad_year"
        type="number"
        defaultValue={profile.grad_year ?? ""}
        className="border rounded px-3 py-2 text-sm"
      />

      <label className="text-sm font-medium">Something we don&apos;t know about you</label>
      <textarea
        name="fun_fact"
        defaultValue={profile.fun_fact ?? ""}
        rows={3}
        className="border rounded px-3 py-2 text-sm"
      />

      <label className="text-sm font-medium">Boat side preference</label>
      <select
        name="boat_side"
        defaultValue={profile.boat_side ?? ""}
        className="border rounded px-3 py-2 text-sm"
      >
        <option value="">No preference</option>
        <option value="port">Port</option>
        <option value="starboard">Starboard</option>
        <option value="either">Either</option>
      </select>

      <label className="text-sm font-medium">Group</label>
      <select
        name="team"
        defaultValue={profile.team ?? ""}
        className="border rounded px-3 py-2 text-sm"
      >
        <option value="">No group</option>
        {TEAM_OPTIONS.map((team) => (
          <option key={team} value={team}>
            {TEAM_LABELS[team]}
          </option>
        ))}
      </select>

      <label className="text-sm font-medium">2K erg time</label>
      <input
        name="erg_2k_time"
        placeholder="e.g. 6:45.2"
        defaultValue={profile.erg_2k_time ?? ""}
        className="border rounded px-3 py-2 text-sm"
      />

      <label className="text-sm font-medium">5K erg time</label>
      <input
        name="erg_5k_time"
        placeholder="e.g. 18:20.5"
        defaultValue={profile.erg_5k_time ?? ""}
        className="border rounded px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || uploading}
          className="bg-[#404040] text-white border-2 border-[#022e5d] rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/roster/${profile.id}`)}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
