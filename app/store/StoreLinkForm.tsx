"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStoreLink } from "./actions";

export function StoreLinkForm({ currentUrl }: { currentUrl: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateStoreLink(formData);
        router.push("/store");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="mt-4 flex flex-col gap-3 max-w-md">
      <label className="text-sm font-medium">Team store URL</label>
      <input
        name="url"
        type="url"
        placeholder="https://..."
        defaultValue={currentUrl ?? ""}
        className="border rounded px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-black text-white rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/store")}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
