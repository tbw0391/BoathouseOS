"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { acceptTerms } from "@/app/terms/actions";
import { unwrap } from "@/lib/userError";

// Shown over every page until a signed-in member agrees to the current Terms
// (members who joined before the Terms existed, or were added by an admin).
// The Terms and Privacy pages stay readable underneath it.
export function TermsGate() {
  const pathname = usePathname();
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done || pathname.startsWith("/terms") || pathname.startsWith("/privacy")) return null;

  function accept() {
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await acceptTerms());
        setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-gate-heading"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl text-gray-900 flex flex-col gap-4"
      >
        <h2 id="terms-gate-heading" className="text-lg font-bold">
          Please review our Terms
        </h2>
        <p className="text-sm text-gray-600">
          BoathouseOS now has Terms of Service. Please read them and our Privacy Policy, then agree
          to keep using the app.
        </p>
        <div className="flex gap-4 text-sm">
          <Link href="/terms" className="underline text-[var(--color-primary)]">
            Terms of Service
          </Link>
          <Link href="/privacy" className="underline text-[var(--color-primary)]">
            Privacy Policy
          </Link>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          I agree to the Terms of Service and Privacy Policy.
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={accept}
          disabled={!agreed || isPending}
          className="rounded-lg bg-[var(--color-secondary)] border-2 border-[var(--color-primary)] px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
