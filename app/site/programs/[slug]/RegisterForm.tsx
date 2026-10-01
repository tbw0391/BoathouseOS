"use client";

import { useState, useTransition } from "react";
import { registerForProgram } from "../actions";
import { unwrapIfResult } from "@/lib/userError";
import type { ProgramQuestion } from "@/lib/programs";

const input = "border rounded-lg px-3 py-2 text-sm w-full";
const label = "text-sm flex flex-col gap-1";

const chip = (on: boolean) =>
  `text-sm rounded-full border px-3 py-1.5 ${on ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "bg-white text-gray-700"}`;

// One participant per registration; "Register someone else" starts a fresh
// form keeping the parent's contact details.
export function RegisterForm({
  programId,
  waiver,
  questions,
  full,
  price,
}: {
  programId: string;
  waiver: string | null;
  questions: ProgramQuestion[];
  full: boolean;
  price: string | null;
}) {
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ status: string; name: string } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [contact, setContact] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="rounded-xl border-2 border-green-600 bg-green-50 p-4 flex flex-col gap-3">
        <p>
          {done.status === "waitlist"
            ? `${done.name} is on the waitlist. The club will contact you if a spot opens up.`
            : `${done.name} is registered!`}{" "}
          A confirmation is on its way to your email.
          {done.status !== "waitlist" && price && price !== "Free" && " The club will be in touch about payment."}
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setPicks({});
            setFormKey((k) => k + 1);
          }}
          className="self-start rounded-lg border-2 border-[var(--color-primary)] text-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold"
        >
          Register someone else
        </button>
      </div>
    );
  }

  return (
    <form
      key={formKey}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        for (const [id, v] of Object.entries(picks)) data.set(`q:${id}`, v);
        const name = String(data.get("participant_name") ?? "");
        const keep = Object.fromEntries(
          ["guardian_name", "email", "phone", "emergency_name", "emergency_phone"].map((k) => [k, String(data.get(k) ?? "")])
        );
        setError(null);
        start(async () => {
          try {
            const result = unwrapIfResult(await registerForProgram(data)) as { status: string } | undefined;
            setContact(keep);
            setDone({ status: result?.status ?? "registered", name });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
          }
        });
      }}
    >
      <input type="hidden" name="program_id" value={programId} />
      {/* Honeypot: hidden from people, filled in by bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {full && <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">This program is full. Sign up below to join the waitlist.</p>}

      <fieldset className="flex flex-col gap-3">
        <legend className="font-semibold mb-1">Participant</legend>
        <label className={label}>
          Full name
          <input name="participant_name" required className={input} />
        </label>
        <label className={label}>
          Birth date
          <input name="participant_birthdate" type="date" className={`${input} w-48`} />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-semibold mb-1">Parent or guardian (or yourself, if 18+)</legend>
        <label className={label}>
          Name
          <input name="guardian_name" defaultValue={contact.guardian_name} className={input} />
        </label>
        <label className={label}>
          Email
          <input name="email" type="email" required defaultValue={contact.email} className={input} />
        </label>
        <label className={label}>
          Phone
          <input name="phone" type="tel" required defaultValue={contact.phone} className={input} />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-semibold mb-1">Emergency contact</legend>
        <label className={label}>
          Name
          <input name="emergency_name" required defaultValue={contact.emergency_name} className={input} />
        </label>
        <label className={label}>
          Phone
          <input name="emergency_phone" type="tel" required defaultValue={contact.emergency_phone} className={input} />
        </label>
        <label className={label}>
          Allergies, medications or medical notes (optional)
          <textarea name="medical_notes" rows={3} className={input} />
        </label>
      </fieldset>

      {questions.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="font-semibold mb-1">A few more questions</legend>
          {questions.map((q) => (
            <div key={q.id} className={label}>
              <span>
                {q.label}
                {q.required && <span className="text-red-600"> *</span>}
              </span>
              {q.kind === "short" && <input name={`q:${q.id}`} required={q.required} className={input} />}
              {q.kind === "long" && <textarea name={`q:${q.id}`} required={q.required} rows={3} className={input} />}
              {(q.kind === "yes_no" || q.kind === "choice") && (
                <div className="flex flex-wrap gap-2">
                  {(q.kind === "yes_no" ? ["Yes", "No"] : q.options).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setPicks((p) => ({ ...p, [q.id]: p[q.id] === o ? "" : o }))}
                      className={chip(picks[q.id] === o)}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </fieldset>
      )}

      {waiver && (
        <fieldset className="flex flex-col gap-2">
          <legend className="font-semibold mb-1">Waiver</legend>
          <div className="text-xs text-gray-700 border rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-line">{waiver}</div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="waiver" required className="w-4 h-4 mt-0.5" />I have read and agree to the waiver, as the
            participant or their parent/guardian.
          </label>
        </fieldset>
      )}

      <button type="submit" disabled={pending} className="self-start rounded-lg bg-[var(--color-primary)] text-white px-5 py-2.5 font-semibold disabled:opacity-50">
        {pending ? "Sending…" : full ? "Join the waitlist" : "Register"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
