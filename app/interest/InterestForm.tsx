"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitInterest } from "./actions";

export function InterestForm() {
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await submitInterest(formData);
        setSubmitted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (submitted) {
    return (
      <div className="max-w-md border rounded-lg p-4 flex flex-col gap-3">
        <p className="font-medium">Thanks! We&apos;ll be in touch when BoathouseOS is available.</p>
        <Link href="/" className="text-sm text-[var(--color-primary)] hover:underline">
          Try the demo →
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="relative flex flex-col gap-3 max-w-md border rounded-lg p-4">
      <p className="text-sm text-gray-600">
        Leave an email, a phone number, or both, and we&apos;ll let you know when it&apos;s ready.
      </p>

      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] w-px h-px opacity-0"
      />
      <input name="name" placeholder="Your name (optional)" className="border rounded px-3 py-2 text-sm" />
      <input name="club_name" placeholder="Club name (optional)" className="border rounded px-3 py-2 text-sm" />
      <input name="email" type="email" placeholder="Email" className="border rounded px-3 py-2 text-sm" />
      <input name="phone" type="tel" placeholder="Phone number" className="border rounded px-3 py-2 text-sm" />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50 self-start"
      >
        {isPending ? "Sending..." : "Let me know"}
      </button>
    </form>
  );
}
