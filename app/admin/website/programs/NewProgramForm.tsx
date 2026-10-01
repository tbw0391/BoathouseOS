"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProgram } from "./actions";
import { unwrap } from "@/lib/userError";

export function NewProgramForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          try {
            const { id } = unwrap(await createProgram(data));
            router.push(`/admin/website/programs/${id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
          }
        });
      }}
    >
      <input name="title" required placeholder="Name, e.g. Youth Summer Camp, Week 1" className="border rounded px-3 py-2 text-sm flex-1 min-w-48" />
      <button
        type="submit"
        disabled={pending}
        className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add program"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
