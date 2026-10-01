"use client";

import { useState, useTransition } from "react";
import { submitResponse, withdrawResponse, formFileUploadUrl } from "../actions";
import { createClient } from "@/lib/supabase/client";
import { fileNameFromPath } from "@/lib/forms";
import type { FormQuestion } from "@/lib/database.types";
import { unwrap } from "@/lib/userError";

type Answers = Record<string, string | string[]>;

const chip = (on: boolean) =>
  `text-sm rounded-full border px-3 py-1.5 text-left ${
    on ? "bg-[var(--color-secondary)] text-white border-[var(--color-primary)]" : "bg-white text-gray-700"
  }`;

export function FillForm({
  formId,
  questions,
  initial,
  submitted,
}: {
  formId: string;
  questions: FormQuestion[];
  initial: Answers;
  submitted: boolean;
}) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const set = (id: string, value: string | string[]) => {
    setSaved(false);
    setAnswers((a) => ({ ...a, [id]: value }));
  };

  async function upload(q: FormQuestion, file: File) {
    setError(null);
    setUploading(q.id);
    try {
      const { path, token } = unwrap(await formFileUploadUrl(formId, q.id, file.name, file.size));
      const { error: upErr } = await createClient()
        .storage.from("form-files")
        .uploadToSignedUrl(path, token, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw new Error("Couldn't upload that file. Try again.");
      set(q.id, path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that file.");
    } finally {
      setUploading(null);
    }
  }

  function submit() {
    setError(null);
    start(async () => {
      try {
        unwrap(await submitResponse(formId, answers));
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function withdraw() {
    setError(null);
    start(async () => {
      try {
        unwrap(await withdrawResponse(formId));
        setAnswers({});
        setSaved(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {questions.map((q) => {
        const value = answers[q.id];
        const text = typeof value === "string" ? value : "";
        const picks = Array.isArray(value) ? value : [];
        return (
          <div key={q.id} className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              {q.label}
              {q.required && <span className="text-red-600"> *</span>}
            </span>
            {q.help && <span className="text-xs text-gray-500">{q.help}</span>}
            {q.kind === "short" && (
              <input value={text} onChange={(e) => set(q.id, e.target.value)} className="border rounded px-3 py-2" />
            )}
            {q.kind === "long" && (
              <textarea value={text} onChange={(e) => set(q.id, e.target.value)} rows={4} className="border rounded px-3 py-2" />
            )}
            {q.kind === "number" && (
              <input
                type="number"
                inputMode="decimal"
                value={text}
                onChange={(e) => set(q.id, e.target.value)}
                className="border rounded px-3 py-2 w-40"
              />
            )}
            {q.kind === "date" && (
              <input type="date" value={text} onChange={(e) => set(q.id, e.target.value)} className="border rounded px-3 py-2 w-48" />
            )}
            {(q.kind === "choice" || q.kind === "yes_no") && (
              <div className="flex flex-wrap gap-2">
                {(q.kind === "yes_no" ? ["Yes", "No"] : q.options).map((o) => (
                  <button key={o} type="button" onClick={() => set(q.id, text === o ? "" : o)} className={chip(text === o)}>
                    {o}
                  </button>
                ))}
              </div>
            )}
            {q.kind === "checkboxes" && (
              <div className="flex flex-wrap gap-2">
                {q.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => set(q.id, picks.includes(o) ? picks.filter((p) => p !== o) : [...picks, o])}
                    className={chip(picks.includes(o))}
                  >
                    {picks.includes(o) ? "✓ " : ""}
                    {o}
                  </button>
                ))}
              </div>
            )}
            {q.kind === "file" && (
              <div className="flex flex-col gap-1">
                {text && <span className="text-xs">Uploaded: {fileNameFromPath(text)}</span>}
                <input
                  type="file"
                  disabled={uploading !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(q, file);
                  }}
                  className="text-sm"
                />
                {uploading === q.id && <span className="text-xs text-gray-500">Uploading…</span>}
              </div>
            )}
          </div>
        );
      })}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Sent ✓ You can change your answers until it closes.</p>}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={pending || uploading !== null}
          className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {pending ? "Sending…" : submitted || saved ? "Update my answers" : "Send"}
        </button>
        {(submitted || saved) && (
          <button type="button" onClick={withdraw} disabled={pending} className="text-sm text-red-600 hover:underline">
            Take back my answers
          </button>
        )}
      </div>
    </div>
  );
}
