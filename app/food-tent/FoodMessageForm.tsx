"use client";

import { useRef, useState, useTransition } from "react";
import { postFoodTentMessage } from "./actions";
import { unwrap } from "@/lib/userError";

const chip = (on: boolean) =>
  `text-sm rounded-full border px-3 py-1.5 ${
    on ? "bg-[var(--color-secondary)] text-white border-[var(--color-primary)]" : "bg-white text-gray-700"
  }`;

// Tent leaders, coaches and admins: a banner on families' (or everyone's)
// home page, optionally about one regatta and with a phone alert (0118).
export function FoodMessageForm({ regattas }: { regattas: { id: string; label: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<"families" | "everyone">("families");
  const [eventId, setEventId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSent(false);
          }}
          className="text-sm bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2"
        >
          Post a banner message
        </button>
        {sent && <span className="text-sm text-green-700">Posted ✓</span>}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className="border rounded-lg p-4 flex flex-col gap-3 max-w-lg"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set("audience", audience);
        data.set("event_id", eventId);
        setError(null);
        start(async () => {
          try {
            unwrap(await postFoodTentMessage(data));
            formRef.current?.reset();
            setOpen(false);
            setSent(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
          }
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Banner message</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:underline">
          Cancel
        </button>
      </div>
      <textarea
        name="message"
        required
        rows={3}
        maxLength={1000}
        placeholder="We still need 2 more crockpots of mac & cheese for Saturday!"
        className="border rounded px-3 py-2 text-sm"
      />
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Show it to</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setAudience("families")} className={chip(audience === "families")}>
            Parents &amp; guardians
          </button>
          <button type="button" onClick={() => setAudience("everyone")} className={chip(audience === "everyone")}>
            Everyone
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">How long</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEventId("")} className={chip(eventId === "")}>
            One week
          </button>
          {regattas.map((r) => (
            <button key={r.id} type="button" onClick={() => setEventId(r.id)} className={chip(eventId === r.id)}>
              Until after {r.label}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="alert" className="w-4 h-4" />
        Also send a phone alert
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50 self-start"
      >
        {pending ? "Posting…" : "Post"}
      </button>
    </form>
  );
}
