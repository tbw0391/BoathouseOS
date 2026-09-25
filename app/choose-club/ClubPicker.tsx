"use client";

import { useState, useTransition } from "react";
import type { DemoClub } from "@/lib/demoClubs";
import { chooseDemoClub } from "./actions";

export function ClubPicker({ clubs, current }: { clubs: DemoClub[]; current: string | null }) {
  const [query, setQuery] = useState("");
  const [pendingSlug, setPendingSlug] = useState<string | null | undefined>(undefined);
  const [, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const shown = q
    ? clubs.filter((c) => c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q))
    : clubs;

  function choose(slug: string | null) {
    setPendingSlug(slug);
    startTransition(() => chooseDemoClub(slug));
  }

  const busy = pendingSlug !== undefined;

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by club or city"
        className="border rounded px-3 py-2"
      />

      <ul className="flex flex-col gap-2">
        {shown.map((c) => (
          <li key={c.slug}>
            <button
              onClick={() => choose(c.slug)}
              disabled={busy}
              className={`w-full flex items-center gap-3 text-left rounded-lg border-2 px-3 py-2 bg-white hover:bg-gray-50 disabled:opacity-60 ${
                c.slug === current ? "border-[var(--color-primary)]" : "border-gray-200"
              }`}
            >
              <span className="w-[66px] h-9 shrink-0 flex items-center justify-center">
                {c.blade ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.blade} alt="" width={66} height={36} />
                ) : (
                  <span className="text-[10px] text-gray-400">No blade</span>
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium leading-tight">{c.name}</span>
                <span className="block text-xs text-gray-500">{c.location}</span>
              </span>
              {c.colors && (
                <span className="flex gap-1 shrink-0" aria-hidden>
                  <span className="w-4 h-4 rounded-full" style={{ background: c.colors.primary }} />
                  <span className="w-4 h-4 rounded-full" style={{ background: c.colors.secondary }} />
                </span>
              )}
              {pendingSlug === c.slug && <span className="text-xs text-gray-500">Loading…</span>}
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="text-sm text-gray-500">No clubs match.</li>}
      </ul>

      <button
        onClick={() => choose(null)}
        disabled={busy}
        className="text-sm text-gray-600 underline self-center mt-2 disabled:opacity-60"
      >
        {current ? "Go back to the standard BoathouseOS colors" : "Skip, use the standard BoathouseOS colors"}
      </button>
    </div>
  );
}
