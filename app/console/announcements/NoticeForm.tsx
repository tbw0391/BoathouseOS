"use client";

import { useRef, useState, useTransition } from "react";
import { createNotice } from "../actions";
import { unwrap } from "@/lib/userError";

const input = "border rounded px-3 py-2 text-sm bg-white";

export function NoticeForm({ clubs }: { clubs: { id: string; name: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ recipients: number; pushed: number; emailed: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSent(null);
    startTransition(async () => {
      try {
        setSent(unwrap(await createNotice(formData)));
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
      <h2 className="text-lg font-semibold">New announcement</h2>
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
        <input name="title" placeholder="Title, e.g. Scheduled maintenance Sunday night" required maxLength={120} className={input} />
        <textarea name="body" placeholder="Message" required rows={4} maxLength={2000} className={input} />

        <div className="flex flex-wrap gap-4 text-sm">
          <fieldset className="flex flex-col gap-1">
            <legend className="font-medium mb-1">Who sees it</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="audience" value="admins" defaultChecked /> Club admins
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="audience" value="everyone" /> Every member
            </label>
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Which clubs</span>
            <select name="club_id" className={input}>
              <option value="">Every club</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Show for</span>
            <select name="days" defaultValue="14" className={input}>
              <option value="1">1 day</option>
              <option value="7">1 week</option>
              <option value="14">2 weeks</option>
              <option value="30">1 month</option>
              <option value="0">Until taken down</option>
            </select>
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="font-medium mb-1">Also send now</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="push" /> Phone alert
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="email" /> Email
            </label>
          </fieldset>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="self-start bg-[var(--color-primary)] text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "Posting..." : "Post announcement"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {sent && (
          <p className="text-sm text-green-700">
            Posted for {sent.recipients} {sent.recipients === 1 ? "person" : "people"}
            {sent.pushed > 0 && `, phone alert sent`}
            {sent.emailed > 0 && `, emailed ${sent.emailed}`}.
          </p>
        )}
      </form>
    </section>
  );
}
