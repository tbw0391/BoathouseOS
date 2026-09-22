"use client";

import { useState, useTransition } from "react";
import { signUpForNeed, cancelNeedSignup } from "./actions";

export function SignupControl({
  needId,
  signedUp,
  full,
}: {
  needId: string;
  signedUp: boolean;
  full: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSignUp() {
    setError(null);
    startTransition(async () => {
      try {
        await signUpForNeed(needId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      try {
        await cancelNeedSignup(needId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (signedUp) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-green-700">You&apos;re signed up</span>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="text-sm text-red-600 hover:underline disabled:opacity-50"
        >
          Cancel
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSignUp}
        disabled={isPending || full}
        className="text-sm bg-[#404040] text-white border-2 border-[#022e5d] rounded px-3 py-1 disabled:opacity-50"
      >
        {isPending ? "Signing up..." : full ? "Full" : "Sign me up"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
