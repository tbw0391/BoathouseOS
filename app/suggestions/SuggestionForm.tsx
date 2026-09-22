"use client";

import { useRef, useState, useTransition } from "react";
import { submitSuggestion } from "./actions";

export function SuggestionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSubmitted(false);
    startTransition(async () => {
      try {
        await submitSuggestion(formData);
        formRef.current?.reset();
        setSubmitted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex flex-col gap-3 max-w-md border rounded-lg p-4"
    >
      <label className="text-sm font-medium">Got an idea for the app or the club?</label>

      <fieldset className="flex gap-4">
        <legend className="text-xs text-gray-500 mb-1">Is this about...</legend>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name="category" value="club" required className="w-4 h-4" />
          The club (practices, events, gear, etc.)
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name="category" value="app" required className="w-4 h-4" />
          This app (a feature, a bug, etc.)
        </label>
      </fieldset>

      <textarea
        name="body"
        required
        rows={4}
        placeholder="Tell us what you'd like to see..."
        className="border rounded px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {submitted && <p className="text-sm text-green-700">Thanks! Your suggestion was submitted.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50 self-start"
      >
        {isPending ? "Submitting..." : "Submit suggestion"}
      </button>
    </form>
  );
}
