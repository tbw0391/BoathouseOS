"use client";

import { useState, useTransition } from "react";
import { savePaperwork } from "@/app/roster/[id]/paperworkActions";
import {
  STATUS_STYLE,
  paperworkStatus,
  suggestedExpiry,
  type PaperworkKind,
  type PaperworkRecord,
} from "@/lib/paperwork";
import { unwrap } from "@/lib/userError";

function shortDate(key: string) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// One piece of paperwork for one person: a status chip that opens a small
// date form.
export function PaperworkChip({
  profileId,
  kind,
  label,
  record,
  todayKey,
  showLabel = false,
}: {
  profileId: string;
  kind: PaperworkKind;
  label: string;
  record: PaperworkRecord | null;
  todayKey: string;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [completed, setCompleted] = useState(record?.completed_on ?? "");
  const [expires, setExpires] = useState(record?.expires_on ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const status = paperworkStatus(record, todayKey);
  const style = STATUS_STYLE[status];

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`rounded-full px-2 py-0.5 text-xs font-medium text-left ${style.className}`}
        title={label}
      >
        {showLabel ? `${label}: ` : ""}
        {status === "missing"
          ? style.label
          : record?.expires_on
            ? `${status === "expired" ? "Expired" : "Until"} ${shortDate(record.expires_on)}`
            : style.label}
        {record?.checked_by ? " ✓" : ""}
      </button>
      {open && (
        <form
          className="flex flex-col gap-1 rounded border border-gray-200 p-2 text-xs bg-white"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              try {
                unwrap(await savePaperwork(profileId, kind, completed, expires));
                setOpen(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't save.");
              }
            });
          }}
        >
          <label className="flex items-center justify-between gap-2">
            Done on
            <input
              type="date"
              value={completed}
              onChange={(e) => {
                setCompleted(e.target.value);
                if (e.target.value && !expires) setExpires(suggestedExpiry(kind, e.target.value) ?? "");
              }}
              className="border rounded px-1"
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            Runs out
            <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="border rounded px-1" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="underline font-medium disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="underline text-gray-500">
              Cancel
            </button>
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
