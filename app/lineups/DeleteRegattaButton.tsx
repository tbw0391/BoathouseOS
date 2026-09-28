"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRegatta } from "./actions";

// Two taps, with what goes along with it spelled out, since a regatta takes
// its results and medals with it.
export function DeleteRegattaButton({ eventId, title }: { eventId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-red-600 hover:text-red-700"
      >
        Delete regatta
      </button>
    );
  }

  return (
    <div className="max-w-md rounded-lg border-2 border-red-600 p-3 flex flex-col gap-2 text-sm">
      <p className="font-medium">Delete {title}?</p>
      <p className="text-gray-600">
        This also deletes its races, boats and lineups, oar sheets, results and medals, food tent
        list, volunteer slots, trailer list and travel plans. It can&apos;t be undone.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await deleteRegatta(eventId);
                router.push("/lineups");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Couldn't delete.");
              }
            });
          }}
          className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 font-medium disabled:opacity-60"
        >
          {isPending ? "Deleting..." : "Yes, delete"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="rounded-lg border-2 border-gray-300 px-4 py-2"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
