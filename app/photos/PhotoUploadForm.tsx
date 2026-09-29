"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, X } from "lucide-react";
import { dayLabel, type PhotoBoatDay } from "@/lib/photoBoats";
import { createClient } from "@/lib/supabase/client";
import { addPhoto } from "./actions";
import { unwrap } from "@/lib/userError";

interface RosterOption {
  id: string;
  display_name: string;
}

export function PhotoUploadForm({
  userId,
  roster,
  boatDays,
  todayKey,
}: {
  userId: string;
  roster: RosterOption[];
  boatDays: PhotoBoatDay[];
  todayKey: string;
}) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [boatDay, setBoatDay] = useState(boatDays[0]?.dateKey ?? null);
  const nameById = new Map(roster.map((m) => [m.id, m.display_name]));
  const dayBoats = boatDays.find((d) => d.dateKey === boatDay)?.boats ?? [];

  // Tapping a boat tags its whole crew from that day's lineup; tapping it
  // again (once they're all tagged) takes them back off.
  function toggleBoat(memberIds: string[]) {
    setTaggedIds((prev) =>
      memberIds.every((id) => prev.includes(id))
        ? prev.filter((id) => !memberIds.includes(id))
        : [...prev, ...memberIds.filter((id) => !prev.includes(id))]
    );
  }

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreview(file ? URL.createObjectURL(file) : null);
    setError(null);
  }

  function toggleTag(id: string) {
    setTaggedIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fileInput = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Choose a photo first.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("photos").upload(path, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("photos").getPublicUrl(path);

      const formData = new FormData();
      formData.set("url", data.publicUrl);
      formData.set("caption", caption);
      taggedIds.forEach((id) => formData.append("tagged_profile_ids", id));

      startTransition(async () => {
        try {
          unwrap(await addPhoto(formData));
          setCaption("");
          setTaggedIds([]);
          fileInput.value = "";
          setPreview(null);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border p-4 mb-6 max-w-lg"
    >
      <h2 className="text-sm font-medium">Add a photo</h2>

      <input ref={fileRef} type="file" name="file" accept="image/*" onChange={pickFile} className="sr-only" />
      {preview ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of an unsent file */}
          <img src={preview} alt="Photo to post" className="w-full max-h-72 object-contain rounded-lg border" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="self-start text-sm text-gray-600 underline"
          >
            Change photo
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-white px-6 py-4 text-lg font-bold transition-colors"
        >
          <Camera className="w-6 h-6" aria-hidden />
          Add photo
        </button>
      )}

      <input
        placeholder="Caption (optional)"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        className="border rounded px-3 py-2 text-sm"
      />

      {boatDays.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-600">Tag a whole boat</p>
          <div className="flex flex-wrap gap-2">
            {boatDays.map((d) => (
              <button
                key={d.dateKey}
                type="button"
                onClick={() => setBoatDay(d.dateKey)}
                aria-pressed={boatDay === d.dateKey}
                className={`rounded-lg border-2 px-3 py-1.5 text-sm ${
                  boatDay === d.dateKey
                    ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white font-medium"
                    : "border-gray-300"
                }`}
              >
                {dayLabel(d.dateKey, todayKey)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {dayBoats.map((b) => {
              const allTagged = b.memberIds.every((id) => taggedIds.includes(id));
              return (
                <button
                  key={b.lineupId}
                  type="button"
                  onClick={() => toggleBoat(b.memberIds)}
                  aria-pressed={allTagged}
                  className={`rounded-lg border-2 px-3 py-2 text-left text-sm ${
                    allTagged ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white" : "border-gray-300"
                  }`}
                >
                  <span className="block font-medium">{b.label}</span>
                  <span className={`block text-xs ${allTagged ? "text-white/80" : "text-gray-500"}`}>
                    {b.eventTitle} · {b.memberIds.length} {b.memberIds.length === 1 ? "person" : "people"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {taggedIds.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Tagged">
          {taggedIds.map((id) => (
            <span
              key={id}
              className="flex items-center gap-1 rounded-full bg-[var(--color-secondary)] text-white pl-3 pr-1 py-1 text-sm"
            >
              {nameById.get(id) ?? "Unknown"}
              <button
                type="button"
                onClick={() => toggleTag(id)}
                aria-label={`Untag ${nameById.get(id) ?? "this person"}`}
                className="p-1 rounded-full hover:bg-white/20"
              >
                <X className="w-3.5 h-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-sm text-gray-600">{boatDays.length > 0 ? "Tag other people (optional)" : "Tag people (optional)"}</p>
        <div className="max-h-40 overflow-y-auto border rounded p-2 flex flex-col gap-1">
          {roster.map((member) => (
            <label key={member.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={taggedIds.includes(member.id)}
                onChange={() => toggleTag(member.id)}
              />
              {member.display_name}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={uploading || isPending}
        className="self-start bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {uploading ? "Uploading..." : isPending ? "Saving..." : "Post photo"}
      </button>
    </form>
  );
}
