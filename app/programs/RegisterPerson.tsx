"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cancelMemberRegistration, registerMember } from "./actions";
import type { ProgramQuestion } from "@/lib/programs";
import { unwrap } from "@/lib/userError";

const chip = (on: boolean) =>
  `text-sm rounded-full border px-3 py-1.5 ${
    on ? "bg-[var(--color-secondary)] text-white border-[var(--color-primary)]" : "bg-white text-gray-700"
  }`;

// One family member's line on a program: their status, or "Register" with
// the program's own questions and waiver. Everything else comes from the app.
export function RegisterPerson({
  programId,
  person,
  questions,
  waiver,
  registration,
  open,
  full,
}: {
  programId: string;
  person: { id: string; name: string; isMe: boolean; contactMissing: boolean };
  questions: ProgramQuestion[];
  waiver: string | null;
  registration: { id: string; status: string } | null;
  open: boolean;
  full: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = person.isMe ? "Myself" : person.name;

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    start(async () => {
      try {
        await fn();
        setEditing(false);
        setConfirmCancel(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  };

  if (registration) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm py-1">
        <span>
          <strong>{label}</strong>{" "}
          {registration.status === "waitlist" ? (
            <span className="text-amber-700">· On the waitlist</span>
          ) : (
            <span className="text-green-700">· Registered ✓</span>
          )}
        </span>
        {open && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              confirmCancel ? run(async () => unwrap(await cancelMemberRegistration(registration.id))) : setConfirmCancel(true)
            }
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            {confirmCancel ? "Tap again to cancel" : "Cancel"}
          </button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  if (!open) return null;

  if (person.contactMissing) {
    return (
      <p className="text-sm py-1">
        <strong>{label}</strong>{" "}
        <span className="text-gray-500">
          · needs an emergency contact first.{" "}
          <Link href={`/roster/${person.id}`} className="text-[var(--color-primary)] underline">
            Add it on {person.isMe ? "your" : "their"} profile
          </Link>
        </span>
      </p>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="self-start text-sm bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-1.5"
      >
        {full ? "Waitlist" : "Register"} {person.isMe ? "myself" : person.name}
      </button>
    );
  }

  return (
    <div className="border rounded-lg p-3 flex flex-col gap-3 text-sm">
      <p className="font-medium">
        {full ? "Waitlist" : "Register"} {person.isMe ? "yourself" : person.name}
      </p>
      <p className="text-xs text-gray-500">
        Birthday, contact details, emergency contact and medical notes come from {person.isMe ? "your" : "their"} profile.
      </p>
      {questions.map((q) => (
        <div key={q.id} className="flex flex-col gap-1">
          <span>
            {q.label}
            {q.required && <span className="text-red-600"> *</span>}
          </span>
          {(q.kind === "short" || q.kind === "long") &&
            (q.kind === "short" ? (
              <input
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                className="border rounded px-3 py-2"
              />
            ) : (
              <textarea
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={3}
                className="border rounded px-3 py-2"
              />
            ))}
          {(q.kind === "yes_no" || q.kind === "choice") && (
            <div className="flex flex-wrap gap-2">
              {(q.kind === "yes_no" ? ["Yes", "No"] : q.options).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: a[q.id] === o ? "" : o }))}
                  className={chip(answers[q.id] === o)}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {waiver && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-gray-700 border rounded p-2 max-h-40 overflow-y-auto whitespace-pre-line">{waiver}</div>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-4 h-4 mt-0.5" />
            I agree to the waiver{person.isMe ? "" : ` as ${person.name}'s parent or guardian`}.
          </label>
        </div>
      )}
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-3 items-center">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(async () => unwrap(await registerMember(programId, person.id, answers, agreed)))}
          className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-1.5 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Confirm"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-gray-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
