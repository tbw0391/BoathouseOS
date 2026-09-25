"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewRegattaUrl, createRegattaFromPreview, type RegattaUrlPreview } from "./actions";

export function AddRegattaFromUrlForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<RegattaUrlPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLookup() {
    setError(null);
    setPreview(null);
    const formData = new FormData();
    formData.set("url", url);
    startTransition(async () => {
      try {
        const result = await previewRegattaUrl(formData);
        setPreview(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't look that up.");
      }
    });
  }

  function handleCreate(formData: FormData) {
    setError(null);
    if (preview?.iconUrl) formData.set("icon_url", preview.iconUrl);
    if (preview?.crewtimerMobileId) formData.set("crewtimer_mobile_id", preview.crewtimerMobileId);
    if (preview?.raceRows?.length) formData.set("race_rows_json", JSON.stringify(preview.raceRows));
    startTransition(async () => {
      try {
        const { eventId } = await createRegattaFromPreview(formData);
        router.push(`/lineups/${eventId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function reset() {
    setOpen(false);
    setUrl("");
    setPreview(null);
    setError(null);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start text-sm border-2 border-[var(--color-primary)] rounded px-3 py-2 mb-6"
      >
        Add regatta from a link
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 mb-6 max-w-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-600">Add regatta from a link</h2>
        <button type="button" onClick={reset} className="text-sm text-gray-500 hover:underline">
          Cancel
        </button>
      </div>

      {!preview ? (
        <>
          <p className="text-xs text-gray-500">
            Paste the regatta&apos;s CrewTimer link (or ID) for the title, date, icon, and our races to
            fill in automatically — any other link (e.g. the regatta&apos;s own website) still grabs a
            title and icon, but you&apos;ll fill in the date and races yourself.
          </p>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.crewtimer.com/r12967 or any regatta link"
            className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleLookup}
            disabled={isPending || !url.trim()}
            className="self-start rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Looking up..." : "Look up"}
          </button>
        </>
      ) : (
        <form action={handleCreate} className="flex flex-col gap-3">
          {preview.note && <p className="text-xs text-amber-700">{preview.note}</p>}
          {preview.iconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.iconUrl} alt="" className="w-12 h-12 object-contain self-start" />
          )}
          <input
            name="title"
            defaultValue={preview.title ?? ""}
            required
            placeholder="Event title"
            className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
          />
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            Date
            <input
              type="date"
              name="starts_at_date"
              defaultValue={preview.startsAtDate ?? ""}
              required
              className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <input
            name="location"
            placeholder="Location (optional)"
            className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
          />
          {preview.raceRows.length > 0 ? (
            <p className="text-xs text-green-700">
              Will also import {preview.raceRows.length} race{preview.raceRows.length === 1 ? "" : "s"} for
              our boats from CrewTimer.
            </p>
          ) : preview.crewtimerMobileId ? (
            <p className="text-xs text-gray-500">
              Found this regatta on CrewTimer, but no races for us yet — add them later once entries are in.
            </p>
          ) : !preview.note ? (
            <p className="text-xs text-gray-500">
              Couldn&apos;t auto-import a race schedule from this link — add races afterward the usual way.
            </p>
          ) : null}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="self-start rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create regatta"}
          </button>
        </form>
      )}
    </div>
  );
}
