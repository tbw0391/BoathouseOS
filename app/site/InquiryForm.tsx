"use client";

import { useRef, useState, useTransition } from "react";
import { submitInquiry } from "./actions";
import { unwrapIfResult } from "@/lib/userError";

const input = "border rounded-lg px-3 py-2 text-sm w-full";

export function InquiryForm({ kind }: { kind: "contact" | "join" }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <p className="rounded-xl border-2 border-green-600 bg-green-50 p-4">
        Thanks! Your message is on its way to the club, and someone will be in touch.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-3 max-w-lg"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          try {
            unwrapIfResult(await submitInquiry(data));
            setSent(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
          }
        });
      }}
    >
      <input type="hidden" name="kind" value={kind} />
      {/* Honeypot: hidden from people, filled in by bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <input name="name" required placeholder="Your name" className={input} />
      <input name="email" type="email" placeholder="Email" className={input} />
      <input name="phone" type="tel" placeholder="Phone (optional if you gave an email)" className={input} />
      <textarea
        name="message"
        rows={5}
        placeholder={kind === "join" ? "Who's interested (you, your child), age or grade, any rowing experience…" : "Your message"}
        className={input}
      />
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-[var(--color-primary)] text-white px-5 py-2.5 font-semibold disabled:opacity-50">
        {pending ? "Sending…" : "Send"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
