"use client";

import { useState, useTransition } from "react";
import { approveMember, declineMember } from "./actions";

export type PendingMember = {
  id: string;
  display_name: string;
  email: string;
  role: string;
};

export function PendingApprovals({ members }: { members: PendingMember[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(id: string, action: (id: string) => Promise<void>) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await action(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="mt-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
      <h2 className="font-semibold">Waiting for approval ({members.length})</h2>
      <p className="text-xs text-gray-600 mb-3">
        These people signed up themselves. They can&apos;t see anything until you approve them.
      </p>
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 bg-white rounded px-3 py-2">
            <div className="text-sm">
              <p className="font-medium">
                {m.display_name} <span className="text-gray-500 capitalize">({m.role})</span>
              </p>
              <p className="text-xs text-gray-500 break-all">{m.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => run(m.id, approveMember)}
                disabled={busyId !== null}
                className="text-sm rounded bg-[var(--color-primary)] text-white px-3 py-1.5 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Decline ${m.display_name}? This deletes their account.`)) {
                    run(m.id, declineMember);
                  }
                }}
                disabled={busyId !== null}
                className="text-sm rounded border-2 border-red-600 text-red-600 px-3 py-1.5 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
