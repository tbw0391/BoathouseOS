"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteProgram, saveProgram } from "../actions";
import { PROGRAM_QUESTION_KINDS, type Program, type ProgramQuestion } from "@/lib/programs";
import { unwrap } from "@/lib/userError";

const input = "border rounded px-3 py-2 text-sm w-full";
const label = "text-sm flex flex-col gap-1";
const chip = (on: boolean) =>
  `text-xs rounded-full border px-2.5 py-1 ${on ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "bg-white text-gray-700"}`;

// datetime-local wants "YYYY-MM-DDTHH:mm" in the browser's own time.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Draft = ProgramQuestion & { optionsText: string };

export function ProgramEditor({ program }: { program: Program }) {
  const router = useRouter();
  const [f, setF] = useState({
    title: program.title,
    description: program.description,
    starts_on: program.starts_on ?? "",
    ends_on: program.ends_on ?? "",
    schedule: program.schedule ?? "",
    ages: program.ages ?? "",
    price: program.price_cents === null ? "" : String(program.price_cents / 100),
    capacity: program.capacity === null ? "" : String(program.capacity),
    opens_at: toLocalInput(program.opens_at),
    closes_at: toLocalInput(program.closes_at),
    published: program.published,
    waiver: program.waiver ?? "",
    sort_order: program.sort_order,
  });
  const [questions, setQuestions] = useState<Draft[]>(program.questions.map((q) => ({ ...q, optionsText: q.options.join("\n") })));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const set = (change: Partial<typeof f>) => {
    setSaved(false);
    setF((x) => ({ ...x, ...change }));
  };
  const setQ = (id: string, change: Partial<Draft>) => {
    setSaved(false);
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...change } : q)));
  };

  function save() {
    setError(null);
    start(async () => {
      try {
        unwrap(
          await saveProgram({
            id: program.id,
            ...f,
            opens_at: f.opens_at ? new Date(f.opens_at).toISOString() : null,
            closes_at: f.closes_at ? new Date(f.closes_at).toISOString() : null,
            questions: questions.map((q) => ({ ...q, options: q.optionsText.split("\n") })),
          })
        );
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    start(async () => {
      try {
        unwrap(await deleteProgram(program.id));
        router.push("/admin/website/programs");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="border-2 rounded-lg px-4 py-3 text-sm flex items-start gap-2 border-[var(--color-primary)]">
        <input type="checkbox" checked={f.published} onChange={(e) => set({ published: e.target.checked })} className="w-4 h-4 mt-0.5" />
        <span>
          <span className="font-medium">Show on the website</span>
          <span className="block text-xs text-gray-500">
            Off: a draft only admins see here. The site also needs Programs ticked under Website &gt; Sections.
          </span>
        </span>
      </label>

      <label className={label}>
        Name
        <input value={f.title} onChange={(e) => set({ title: e.target.value })} className={input} />
      </label>
      <label className={label}>
        Description
        <textarea value={f.description} onChange={(e) => set({ description: e.target.value })} rows={6} className={input} />
        <span className="text-xs text-gray-500">Blank line = new paragraph. &quot;## &quot; starts a heading, &quot;- &quot; a bullet.</span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Starts
          <input type="date" value={f.starts_on} onChange={(e) => set({ starts_on: e.target.value })} className={input} />
        </label>
        <label className={label}>
          Ends
          <input type="date" value={f.ends_on} onChange={(e) => set({ ends_on: e.target.value })} className={input} />
        </label>
      </div>
      <label className={label}>
        Days and times
        <input value={f.schedule} onChange={(e) => set({ schedule: e.target.value })} placeholder="Mon–Fri, 9am–noon" className={input} />
      </label>
      <label className={label}>
        Who it&apos;s for
        <input value={f.ages} onChange={(e) => set({ ages: e.target.value })} placeholder="Ages 12–18, no experience needed" className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Cost ($)
          <input value={f.price} onChange={(e) => set({ price: e.target.value })} inputMode="decimal" placeholder="Blank = not shown" className={input} />
        </label>
        <label className={label}>
          Spots
          <input value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} inputMode="numeric" placeholder="Blank = no limit" className={input} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Registration opens
          <input type="datetime-local" value={f.opens_at} onChange={(e) => set({ opens_at: e.target.value })} className={input} />
        </label>
        <label className={label}>
          Registration closes
          <input type="datetime-local" value={f.closes_at} onChange={(e) => set({ closes_at: e.target.value })} className={input} />
        </label>
      </div>
      <p className="text-xs text-gray-500 -mt-2">Blank: open now / no closing date. Once spots fill, people join a waitlist.</p>

      <label className={label}>
        Waiver (optional)
        <textarea
          value={f.waiver}
          onChange={(e) => set({ waiver: e.target.value })}
          rows={5}
          placeholder="Paste the club's waiver. Families must tick 'I agree' to register."
          className={input}
        />
      </label>

      <label className={`${label} w-32`}>
        Order on the site
        <input type="number" value={f.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) || 0 })} className={input} />
      </label>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">Extra questions</h2>
        <p className="text-xs text-gray-500">
          Every registration already asks for the participant&apos;s name and birth date, a parent/guardian&apos;s name, email and
          phone, an emergency contact, and medical notes.
        </p>
        {questions.map((q) => (
          <div key={q.id} className="border rounded-lg p-3 flex flex-col gap-2 text-sm">
            <div className="flex gap-2">
              <input
                value={q.label}
                onChange={(e) => setQ(q.id, { label: e.target.value })}
                placeholder="T-shirt size? Can they swim 100 yards?"
                className={input}
              />
              <button
                type="button"
                onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}
                className="p-1 text-red-600"
                aria-label="Remove"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PROGRAM_QUESTION_KINDS.map((k) => (
                <button key={k.value} type="button" onClick={() => setQ(q.id, { kind: k.value })} className={chip(q.kind === k.value)}>
                  {k.label}
                </button>
              ))}
            </div>
            {q.kind === "choice" && (
              <textarea
                value={q.optionsText}
                onChange={(e) => setQ(q.id, { optionsText: e.target.value })}
                placeholder="Choices, one per line"
                rows={3}
                className={input}
              />
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={q.required} onChange={(e) => setQ(q.id, { required: e.target.checked })} className="w-4 h-4" />
              Required
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setQuestions((qs) => [...qs, { id: crypto.randomUUID(), label: "", kind: "short", options: [], optionsText: "", required: false }])
          }
          className="text-sm border rounded px-3 py-2 self-start"
        >
          + Add question
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved ✓</p>}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={remove} disabled={pending} className="text-sm text-red-600 border border-red-300 rounded px-3 py-1.5">
          {confirmDelete ? "Tap again: deletes its registrations too" : "Delete program"}
        </button>
      </div>
    </div>
  );
}
