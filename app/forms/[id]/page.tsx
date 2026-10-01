import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Form, FormQuestion, FormResponse } from "@/lib/database.types";
import { answerText, audienceLabel, formIsOpen, formatClosing, votersLabel } from "@/lib/forms";
import { FillForm } from "./FillForm";
import { Ballot } from "./Ballot";
import { ManageControls } from "./ManageControls";
import { ElectionResults } from "./ElectionResults";

export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: formData }, { data: questionData }, { data: canManage }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", id).maybeSingle(),
    supabase.from("form_questions").select("*").eq("form_id", id).order("position"),
    supabase.rpc("can_manage_form", { p_form: id }),
  ]);
  const form = formData as Form | null;
  if (!form) notFound();
  const questions = (questionData as FormQuestion[] | null) ?? [];
  const open = formIsOpen(form);
  const election = form.kind === "election";

  const [{ data: mine }, { data: voted }, { data: blocker }, { data: ballotRows }, answerCount] = await Promise.all([
    election
      ? Promise.resolve({ data: null })
      : supabase.from("form_responses").select("*").eq("form_id", id).eq("respondent_id", user.id).maybeSingle(),
    election
      ? supabase.from("election_voters").select("voted_at").eq("form_id", id).eq("voter_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    election && open ? supabase.rpc("ballot_blocker", { p_form: id }) : Promise.resolve({ data: null }),
    election && !open
      ? supabase.from("election_ballots").select("question_id, choice").eq("form_id", id)
      : Promise.resolve({ data: null }),
    canManage
      ? supabase
          .from(election ? "election_voters" : "form_responses")
          .select("form_id", { count: "exact", head: true })
          .eq("form_id", id)
          .then((r) => r.count ?? 0)
      : Promise.resolve(0),
  ]);
  const myResponse = mine as FormResponse | null;

  return (
    <div className="min-h-screen p-8 max-w-lg mx-auto flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href="/forms" className="text-sm text-gray-500 hover:underline">
          ← Forms &amp; Elections
        </Link>
        {election && <span className="text-xs font-semibold uppercase text-[var(--color-primary)]">Election</span>}
        <h1 className="text-2xl font-bold">{form.title}</h1>
        <p className="text-xs text-gray-500">
          For {audienceLabel(form.audience).toLowerCase()}
          {election && ` · Who can vote: ${votersLabel(form.voters).toLowerCase()}`}
          {open && form.closes_at && ` · Closes ${formatClosing(form.closes_at)}`}
          {!open && " · Closed"}
        </p>
        {form.description && <p className="text-sm whitespace-pre-line mt-1">{form.description}</p>}
      </div>

      {canManage && (
        <ManageControls formId={id} open={open} answerCount={answerCount as number} election={election} />
      )}

      {!election &&
        (open ? (
          <FillForm formId={id} questions={questions} initial={myResponse?.answers ?? {}} submitted={Boolean(myResponse)} />
        ) : myResponse ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-gray-500">This form has closed. Your answers:</p>
            {questions.map((q) => (
              <div key={q.id}>
                <p className="font-medium">{q.label}</p>
                <p>{answerText(q, myResponse.answers[q.id]) || "—"}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">This form has closed.</p>
        ))}

      {election && open && voted && (
        <p className="text-sm text-green-700">
          You voted ✓ Your ballot is secret. Results show here when voting closes.
        </p>
      )}
      {election && open && !voted && blocker && <p className="text-sm text-gray-500">{blocker as string}</p>}
      {election && open && !voted && !blocker && <Ballot formId={id} offices={questions} />}
      {election && !open && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Results</h2>
          <ElectionResults
            offices={questions}
            ballots={(ballotRows as { question_id: string; choice: string }[] | null) ?? []}
          />
        </section>
      )}
    </div>
  );
}
