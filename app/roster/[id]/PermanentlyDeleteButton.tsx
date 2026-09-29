"use client";

import { unwrap, type ActionResult } from "@/lib/userError";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PermanentlyDeleteButton({
  name,
  onDelete,
}: {
  name: string;
  onDelete: () => Promise<ActionResult<void>>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !window.confirm(
        `Permanently delete ${name}? This deletes their profile, messages, and uploaded photos from the database, and their login if they have one. This CANNOT be undone.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await onDelete());
        router.push("/roster");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-full text-sm border-2 border-red-700 bg-red-700 text-white rounded px-3 py-2 disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Permanently delete"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
