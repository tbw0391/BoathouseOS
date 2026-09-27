"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { setBoatFollowed } from "./actions";

// Parents (and anyone else watching) pick boats to hear about when they go
// out, for practices where the crew isn't in a lineup.
export function FollowBoats({
  boats,
  followedIds,
}: {
  boats: { id: string; name: string }[];
  followedIds: string[];
}) {
  const [followed, setFollowed] = useState(() => new Set(followedIds));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(boatId: string) {
    const next = !followed.has(boatId);
    setFollowed((prev) => {
      const s = new Set(prev);
      if (next) s.add(boatId);
      else s.delete(boatId);
      return s;
    });
    setError(null);
    startTransition(async () => {
      try {
        await setBoatFollowed(boatId, next);
      } catch (e) {
        setFollowed((prev) => {
          const s = new Set(prev);
          if (next) s.delete(boatId);
          else s.add(boatId);
          return s;
        });
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  if (boats.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold mb-1">Tell me when these boats go out</h2>
      <p className="text-sm text-gray-500 mb-3">
        You&apos;ll get a phone alert when a boat you follow starts tracking. Turn on alerts on the
        home page first.
      </p>
      <div className="flex flex-wrap gap-2">
        {boats.map((b) => {
          const on = followed.has(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.id)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-full border-2 border-[var(--color-primary)] px-3 py-1.5 text-sm ${
                on ? "bg-[var(--color-secondary)] text-white" : ""
              }`}
            >
              {on ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4 opacity-50" />}
              {b.name}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
