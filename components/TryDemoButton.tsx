"use client";

import { useState, useTransition } from "react";
import { signInAsDemo } from "@/app/login/actions";

export function TryDemoButton({ className }: { className?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startDemo] = useTransition();

  function handleDemo() {
    setError(null);
    startDemo(async () => {
      try {
        await signInAsDemo();
      } catch (err) {
        // redirect() inside the action surfaces as a thrown NEXT_REDIRECT;
        // let Next handle that, and only show real failures.
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        setError("Couldn't open the demo. Please try again.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDemo}
        disabled={pending}
        className={`bg-[var(--color-primary)] text-white rounded px-3 py-3 text-lg font-medium disabled:opacity-50 ${className ?? ""}`}
      >
        {pending ? "Opening demo..." : "Try the demo"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </>
  );
}
