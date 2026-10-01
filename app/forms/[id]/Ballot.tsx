"use client";

import { useState, useTransition } from "react";
import { castBallot } from "../actions";
import type { FormQuestion } from "@/lib/database.types";
import { unwrap } from "@/lib/userError";

const chip = (on: boolean) =>
  `text-sm rounded-full border px-3 py-1.5 text-left ${
    on ? "bg-[var(--color-secondary)] text-white border-[var(--color-primary)]" : "bg-white text-gray-700"
  }`;

// A secret ballot: picks go to cast_ballot() (0115) with no name attached.
// One go only, so it asks to check before sending.
export function Ballot({ formId, offices }: { formId: string; offices: FormQuestion[] }) {
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(office: FormQuestion, name: string) {
    setChecking(false);
    setPicks((p) => {
      const mine = p[office.id] ?? [];
      if (mine.includes(name)) return { ...p, [office.id]: mine.filter((n) => n !== name) };
      if (office.max_picks === 1) return { ...p, [office.id]: [name] };
      if (mine.length >= office.max_picks) return p;
      return { ...p, [office.id]: [...mine, name] };
    });
  }

  function send() {
    setError(null);
    start(async () => {
      try {
        unwrap(await castBallot(formId, picks));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setChecking(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {offices.map((o) => {
        const mine = picks[o.id] ?? [];
        return (
          <div key={o.id} className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{o.label}</span>
            <span className="text-xs text-gray-500">
              {o.max_picks === 1 ? "Pick one" : `Pick up to ${o.max_picks}`} · or leave blank
            </span>
            <div className="flex flex-col gap-2">
              {o.options.map((name) => (
                <button key={name} type="button" onClick={() => toggle(o, name)} className={chip(mine.includes(name))}>
                  {mine.includes(name) ? "✓ " : ""}
                  {name}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {checking && (
        <div className="border rounded-lg p-3 text-sm flex flex-col gap-1 bg-gray-50">
          <span className="font-medium">Your ballot</span>
          {offices.map((o) => (
            <span key={o.id}>
              {o.label}: {(picks[o.id] ?? []).join(", ") || "(blank)"}
            </span>
          ))}
          <span className="text-xs text-gray-500">You can&apos;t change it once it&apos;s sent.</span>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => (checking ? send() : setChecking(true))}
        disabled={pending}
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-4 py-2 text-sm disabled:opacity-50 self-start"
      >
        {pending ? "Sending…" : checking ? "Cast my vote" : "Review my ballot"}
      </button>
    </div>
  );
}
