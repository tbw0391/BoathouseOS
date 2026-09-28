"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import {
  checkInToPractice,
  clearPracticeAttendance,
  markAbsentFromPractice,
} from "@/app/check-in/actions";
import type { AttendanceStatus } from "@/lib/database.types";

// Rowers/coxswains: a big green Check in button, and "I won't be at practice"
// which opens tap buttons for the reason. Once they've answered for today it
// shows their answer with a Change link instead.
export function PracticeCheckIn({
  status,
  reason,
  time,
  reasons,
}: {
  status: AttendanceStatus | null;
  reason: string | null;
  time: string | null;
  reasons: readonly string[];
}) {
  const [pickingReason, setPickingReason] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setPickingReason(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const changeLink = (
    <button
      onClick={() => run(clearPracticeAttendance)}
      disabled={isPending}
      className="text-sm underline text-gray-600 disabled:opacity-60"
    >
      {isPending ? "Changing..." : "Change"}
    </button>
  );

  if (status === "checked_in") {
    return (
      <div className="w-full flex flex-col items-center gap-1">
        <p className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-green-600 bg-green-50 px-6 py-4 text-lg font-medium text-green-800">
          <CircleCheck className="w-6 h-6" aria-hidden />
          Checked in at {time}
        </p>
        {changeLink}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (status === "absent") {
    return (
      <div className="w-full flex flex-col items-center gap-1">
        <p className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-gray-400 bg-gray-50 px-6 py-4 text-lg font-medium text-gray-800">
          <CircleX className="w-6 h-6" aria-hidden />
          Not at practice today: {reason}
        </p>
        {changeLink}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <button
        onClick={() => run(checkInToPractice)}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 px-6 py-4 text-lg font-bold text-white disabled:opacity-60"
      >
        <CircleCheck className="w-6 h-6" aria-hidden />
        {isPending && !pickingReason ? "Checking in..." : "Check in to practice"}
      </button>

      {pickingReason ? (
        <div className="w-full flex flex-col gap-2 rounded-lg border-2 border-gray-300 p-3">
          <p className="text-sm font-medium text-gray-700 text-center">Why can&apos;t you make it?</p>
          <div className="grid grid-cols-2 gap-2">
            {reasons.map((r) => (
              <button
                key={r}
                onClick={() => run(() => markAbsentFromPractice(r))}
                disabled={isPending}
                className="rounded-lg border-2 border-[var(--color-primary)] px-3 py-3 text-sm font-medium hover:bg-[var(--color-secondary)] hover:text-white disabled:opacity-60"
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPickingReason(false)}
            disabled={isPending}
            className="text-sm underline text-gray-600"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPickingReason(true)}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 px-6 py-3 font-medium text-white disabled:opacity-60"
        >
          <CircleX className="w-5 h-5" aria-hidden />
          I won&apos;t be at practice
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
