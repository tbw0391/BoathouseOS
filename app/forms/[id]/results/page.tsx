import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formPending } from "@/lib/formAlerts";
import type { Form, FormQuestion, FormResponse } from "@/lib/database.types";
import { answerText, fileNameFromPath, formIsOpen, formatClosing, kindHasOptions, tally } from "@/lib/forms";
import { ElectionResults } from "../ElectionResults";
import { RemindButton } from "../RemindButton";

// For whoever manages the form: every response (forms), or turnout and,
// once closed, the count (elections; ballots stay secret).
export default async function FormResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: formData }, { data: questionData }, { data: canManage }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", id).maybeSingle(),
    supabase.from("form_questions").select("*").eq("form_id", id).order("position"),
    supabase.rpc("can_manage_form", { p_form: id }),
  ]);
  const form = formData as Form | null;
  if (!form) notFound();
  if (!canManage) redirect(`/forms/${id}`);
  const questions = (questionData as FormQuestion[] | null) ?? [];
  const election = form.kind === "election";
  const open = formIsOpen(form);

  const [{ data: responseRows }, { data: voterRows }, { data: ballotRows }] = await Promise.all([
    election
      ? Promise.resolve({ data: [] })
      : supabase.from("form_responses").select("*").eq("form_id", id).order("submitted_at"),
    election
      ? supabase.from("election_voters").select("voter_id, voted_at").eq("form_id", id).order("voted_at")
      : Promise.resolve({ data: [] }),
    election && !open
      ? supabase.from("election_ballots").select("question_id, choice").eq("form_id", id)
      : Promise.resolve({ data: [] }),
  ]);
  const responses = (responseRows as FormResponse[] | null) ?? [];
  const voters = (voterRows as { voter_id: string; voted_at: string }[] | null) ?? [];
  // Who it's for and hasn't answered (for elections, only people who can
  // still vote).
  const { audience, pending } = await formPending(createAdminClient(), form);
  const peopleIds = [...responses.map((r) => r.respondent_id), ...voters.map((v) => v.voter_id), ...pending];
  const { data: nameRows } = peopleIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", peopleIds)
    : { data: [] };
  const nameById = new Map(((nameRows as { id: string; display_name: string }[] | null) ?? []).map((p) => [p.id, p.display_name]));
  const audienceSize = audience.length;
  const pendingNames = pending
    .map((id) => nameById.get(id))
    .filter((n): n is string => !!n)
    .sort((a, b) => a.localeCompare(b));
  const notAnswered = (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">
        {election ? "Haven't voted" : "Not answered yet"} ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <p className="text-sm text-gray-500">Everyone it&apos;s for has {election ? "voted (or can't vote)" : "answered"}.</p>
      ) : (
        <p className="text-sm">{pendingNames.join(", ")}</p>
      )}
      {open && pending.length > 0 && (
        <RemindButton formId={id} count={pending.length} remindedLabel={form.reminded_at ? formatClosing(form.reminded_at) : null} />
      )}
    </section>
  );

  // Links to uploaded files, good for an hour.
  const filePaths = responses.flatMap((r) =>
    questions.filter((q) => q.kind === "file").map((q) => r.answers[q.id]).filter((v): v is string => typeof v === "string")
  );
  const fileUrl = new Map<string, string>();
  if (filePaths.length) {
    const { data } = await createAdminClient().storage.from("form-files").createSignedUrls(filePaths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) fileUrl.set(s.path, s.signedUrl);
  }

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <Link href={`/forms/${id}`} className="text-sm text-gray-500 hover:underline">
          ← {form.title}
        </Link>
        <h1 className="text-2xl font-bold">{election ? "Turnout & results" : "Responses"}</h1>
      </div>

      {election ? (
        <>
          <section>
            <p className="text-sm">
              <span className="text-2xl font-bold">{voters.length}</span> voted
              {audienceSize > 0 && ` of ${audienceSize} it's for`}
              {form.voters === "family" && " (one per family)"}
            </p>
            <p className="text-xs text-gray-500">
              Who voted is listed; how they voted isn&apos;t stored with their name.
            </p>
            {voters.length > 0 && (
              <p className="text-sm mt-2">{voters.map((v) => nameById.get(v.voter_id) ?? "Someone").join(", ")}</p>
            )}
          </section>
          {notAnswered}
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Results</h2>
            {open ? (
              <p className="text-sm text-gray-500">The count shows here once voting closes.</p>
            ) : (
              <ElectionResults
                offices={questions}
                ballots={(ballotRows as { question_id: string; choice: string }[] | null) ?? []}
              />
            )}
          </section>
        </>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <p className="text-sm">
              <span className="text-2xl font-bold">{responses.length}</span>{" "}
              {responses.length === 1 ? "response" : "responses"}
            </p>
            {responses.length > 0 && (
              <a href={`/forms/${id}/export`} className="text-sm border rounded px-3 py-1.5">
                Download spreadsheet (CSV)
              </a>
            )}
          </div>

          {notAnswered}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Summary</h2>
            {questions.map((q) => {
              const values = responses.map((r) => r.answers[q.id]);
              const answered = values.filter((v) => v !== undefined && v !== "").length;
              return (
                <div key={q.id} className="text-sm">
                  <p className="font-medium">{q.label}</p>
                  {kindHasOptions(q.kind) || q.kind === "yes_no" ? (
                    <ul className="flex flex-col gap-0.5 mt-1">
                      {tally(q, values).map((t) => (
                        <li key={t.option} className="flex items-center gap-2">
                          <span className="flex-1">{t.option}</span>
                          <span
                            className="h-2 rounded bg-[var(--color-secondary)]"
                            style={{ width: `${responses.length ? (t.count / responses.length) * 120 : 0}px` }}
                          />
                          <span className="w-8 text-right text-gray-500">{t.count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500">{answered} answered</p>
                  )}
                </div>
              );
            })}
          </section>

          {responses.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Everyone&apos;s answers</h2>
              {responses.map((r) => (
                <div key={r.id} className="border rounded-lg p-3 text-sm flex flex-col gap-1.5">
                  <p className="font-medium">{nameById.get(r.respondent_id) ?? "Someone"}</p>
                  {questions.map((q) => {
                    const v = r.answers[q.id];
                    return (
                      <div key={q.id}>
                        <p className="text-xs text-gray-500">{q.label}</p>
                        {q.kind === "file" && typeof v === "string" ? (
                          fileUrl.has(v) ? (
                            <a href={fileUrl.get(v)} className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noreferrer">
                              {fileNameFromPath(v)}
                            </a>
                          ) : (
                            <p>{fileNameFromPath(v)}</p>
                          )
                        ) : (
                          <p className="whitespace-pre-line">{answerText(q, v) || "—"}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
