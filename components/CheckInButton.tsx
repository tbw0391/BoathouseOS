"use client";

import { useState, useTransition } from "react";
import { CircleCheck } from "lucide-react";
import { checkIn } from "@/app/check-in/actions";
import { unwrap } from "@/lib/userError";

// Big green button for coaches/admins. Once they've checked in today it
// turns into a quiet confirmation with the time instead.
export function CheckInButton({ checkedInAt }: { checkedInAt: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (checkedInAt) {
    return (
      <p className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-green-600 bg-green-50 px-6 py-4 text-lg font-medium text-green-800">
        <CircleCheck className="w-6 h-6" aria-hidden />
        Checked in at {checkedInAt}
      </p>
    );
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await checkIn());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't check in.");
      }
    });
  }

  return (
    <div className="w-full flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 px-6 py-4 text-lg font-bold text-white disabled:opacity-60"
      >
        <CircleCheck className="w-6 h-6" aria-hidden />
        {isPending ? "Checking in..." : "Check in"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
