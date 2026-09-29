"use client";

import { useState, useTransition } from "react";
import { switchDemoProfile } from "@/app/login/actions";
import { unwrap } from "@/lib/userError";

type Option = { role: string; label: string; blurb: string };

export function ProfilePicker({ profiles, current }: { profiles: Option[]; current: string | null }) {
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function choose(role: string) {
    setError(null);
    setPendingRole(role);
    startTransition(async () => {
      try {
        unwrap(await switchDemoProfile(role));
      } catch (err) {
        // redirect() inside the action surfaces as a thrown NEXT_REDIRECT.
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        setPendingRole(null);
        setError("Couldn't switch. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {profiles.map((p) => (
        <button
          key={p.role}
          onClick={() => choose(p.role)}
          disabled={pendingRole !== null}
          className={`w-full text-left rounded-lg border-2 px-4 py-3 bg-white hover:bg-gray-50 disabled:opacity-60 ${
            p.role === current ? "border-[var(--color-primary)]" : "border-gray-200"
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="font-medium">{p.label}</span>
            {pendingRole === p.role && <span className="text-xs text-gray-500">Loading…</span>}
            {pendingRole === null && p.role === current && (
              <span className="text-xs text-[var(--color-primary)]">Current</span>
            )}
          </span>
          <span className="block text-sm text-gray-600">{p.blurb}</span>
        </button>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
