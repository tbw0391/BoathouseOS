"use client";

import { useRef, useState, useTransition } from "react";
import { sendAnnouncement } from "./actions";

export function AnnouncementForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSent(false);
    startTransition(async () => {
      try {
        await sendAnnouncement(formData);
        formRef.current?.reset();
        setSent(true);
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
      <label className="text-sm font-medium">Send a message to the team</label>

      <fieldset className="flex gap-4">
        <legend className="text-xs text-gray-500 mb-1">Who&apos;s this for?</legend>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name="audience" value="rowers" required className="w-4 h-4" />
          Rowers
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name="audience" value="parents" required className="w-4 h-4" />
          Parents
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name="audience" value="both" required className="w-4 h-4" />
          Both
        </label>
      </fieldset>

      <textarea
        name="message"
        required
        rows={4}
        placeholder="What's the message?"
        className="border rounded px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {sent && <p className="text-sm text-green-700">Sent.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50 self-start"
      >
        {isPending ? "Sending..." : "Send"}
      </button>
    </form>
  );
}
