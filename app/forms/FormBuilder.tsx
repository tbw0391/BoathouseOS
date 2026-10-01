"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { saveForm, type FormInput, type QuestionInput } from "./actions";
import { ELECTION_VOTERS, FORM_AUDIENCES, QUESTION_KINDS, kindHasOptions } from "@/lib/forms";
import { unwrap } from "@/lib/userError";

const chip = (on: boolean) =>
  `text-sm rounded-full border px-3 py-1.5 ${
    on ? "bg-[var(--color-secondary)] text-white border-[var(--color-primary)]" : "bg-white text-gray-700"
  }`;

// datetime-local wants "YYYY-MM-DDTHH:mm" in the phone's own time.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Draft = QuestionInput & { key: number; optionsText: string };

let nextKey = 1;
const blank = (election: boolean): Draft => ({
  key: nextKey++,
  label: "",
  kind: election ? "choice" : "short",
  help: "",
  required: false,
  options: [],
  optionsText: "",
  max_picks: 1,
});

export function FormBuilder({
  initial,
  locked = false,
}: {
  initial: Omit<FormInput, "questions"> & { questions: QuestionInput[] };
  // Someone has answered: questions can't change any more.
  locked?: boolean;
}) {
  const router = useRouter();
  const election = initial.kind === "election";
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [audience, setAudience] = useState(initial.audience);
  const [voters, setVoters] = useState(initial.voters);
  const [closesAt, setClosesAt] = useState(toLocalInput(initial.closes_at));
  const [questions, setQuestions] = useState<Draft[]>(
    initial.questions.length
      ? initial.questions.map((q) => ({ ...q, key: nextKey++, optionsText: q.options.join("\n") }))
      : [blank(election)]
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (key: number, change: Partial<Draft>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...change } : q)));
  const move = (i: number, by: number) =>
    setQuestions((qs) => {
      const j = i + by;
      if (j < 0 || j >= qs.length) return qs;
      const copy = [...qs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  function save() {
    setError(null);
    start(async () => {
      try {
        const { id } = unwrap(
          await saveForm({
            id: initial.id,
            kind: initial.kind,
            title,
            description,
            audience,
            voters,
            closes_at: closesAt ? new Date(closesAt).toISOString() : null,
            questions: questions.map((q) => ({
              label: q.label,
              kind: q.kind,
              help: q.help,
              required: q.required,
              options: q.optionsText.split("\n"),
              max_picks: q.max_picks,
            })),
          })
        );
        router.push(`/forms/${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={election ? "2027 Board Election" : "Spring season survey"}
          className="border rounded px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Description (optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="border rounded px-3 py-2"
        />
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Who it&apos;s for</span>
        <div className="flex flex-wrap gap-2">
          {FORM_AUDIENCES.map((a) => (
            <button key={a.value} type="button" onClick={() => setAudience(a.value)} className={chip(audience === a.value)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {election && (
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Who can vote</span>
          <div className="flex flex-wrap gap-2">
            {ELECTION_VOTERS.map((v) => (
              <button key={v.value} type="button" onClick={() => setVoters(v.value)} className={chip(voters === v.value)}>
                {v.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">{ELECTION_VOTERS.find((v) => v.value === voters)?.detail}</p>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{election ? "Voting closes" : "Closes (optional)"}</span>
        <input
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
          className="border rounded px-3 py-2"
        />
        {election && (
          <span className="text-xs text-gray-500">
            Ballots are secret. Results show to everyone once voting closes.
          </span>
        )}
      </label>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">{election ? "Offices and candidates" : "Questions"}</h2>
        {locked ? (
          <p className="text-sm text-gray-500">
            People have already {election ? "voted" : "answered"}, so the {election ? "offices and candidates" : "questions"}{" "}
            can&apos;t change. You can still change everything above.
          </p>
        ) : (
          <>
            {questions.map((q, i) => (
              <div key={q.key} className="border rounded-lg p-3 flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 flex-1">
                    {election ? "Office" : "Question"} {i + 1}
                  </span>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 disabled:opacity-30" aria-label="Move up">
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === questions.length - 1}
                    className="p-1 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
                    className="p-1 text-red-600"
                    aria-label="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <input
                  value={q.label}
                  onChange={(e) => update(q.key, { label: e.target.value })}
                  placeholder={election ? "President" : "What's your T-shirt size?"}
                  className="border rounded px-3 py-2"
                />
                {!election && (
                  <div className="flex flex-wrap gap-1.5">
                    {QUESTION_KINDS.map((k) => (
                      <button
                        key={k.value}
                        type="button"
                        onClick={() => update(q.key, { kind: k.value })}
                        className={`${chip(q.kind === k.value)} text-xs px-2.5 py-1`}
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>
                )}
                {(election || kindHasOptions(q.kind)) && (
                  <textarea
                    value={q.optionsText}
                    onChange={(e) => update(q.key, { optionsText: e.target.value })}
                    placeholder={election ? "Candidates, one per line" : "Choices, one per line"}
                    rows={3}
                    className="border rounded px-3 py-2"
                  />
                )}
                {election ? (
                  <label className="flex items-center gap-2">
                    Seats (how many people each voter picks)
                    <input
                      type="number"
                      min={1}
                      value={q.max_picks}
                      onChange={(e) => update(q.key, { max_picks: Number(e.target.value) || 1 })}
                      className="border rounded px-2 py-1 w-16"
                    />
                  </label>
                ) : (
                  <>
                    <input
                      value={q.help}
                      onChange={(e) => update(q.key, { help: e.target.value })}
                      placeholder="Extra instructions (optional)"
                      className="border rounded px-3 py-2 text-xs"
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => update(q.key, { required: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Required
                    </label>
                  </>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setQuestions((qs) => [...qs, blank(election)])}
              className="text-sm border rounded px-3 py-2 self-start"
            >
              + Add {election ? "office" : "question"}
            </button>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {pending ? "Saving…" : initial.id ? "Save changes" : election ? "Open the election" : "Post the form"}
      </button>
    </div>
  );
}
