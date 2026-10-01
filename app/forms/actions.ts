"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clubIdOf } from "@/lib/clubs";
import { sendPush } from "@/lib/push";
import { formAudienceIds, formPending, sendFormReminder } from "@/lib/formAlerts";
import { FORM_AUDIENCES, ELECTION_VOTERS, QUESTION_KINDS, canCreateElections, canCreateForms, kindHasOptions } from "@/lib/forms";
import type { Form, FormAudience, FormQuestion, FormQuestionKind, ElectionVoters } from "@/lib/database.types";
import { UserError, tryAction } from "@/lib/userError";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const FILE_LIMIT = 10 * 1024 * 1024;

async function signedIn(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");
  return user;
}

// Its creator, admins and board members (can_manage_form() in 0115).
async function requireManager(supabase: Supabase, formId: string) {
  const user = await signedIn(supabase);
  const { data } = await supabase.rpc("can_manage_form", { p_form: formId });
  if (!data) throw new UserError("Only whoever made this, admins, or board members can do that.");
  return user;
}

function refresh(formId?: string) {
  revalidatePath("/forms");
  if (formId) revalidatePath(`/forms/${formId}`, "layout");
}

export interface QuestionInput {
  label: string;
  kind: FormQuestionKind;
  help: string;
  required: boolean;
  options: string[];
  max_picks: number;
}

export interface FormInput {
  id?: string;
  kind: "form" | "election";
  title: string;
  description: string;
  audience: FormAudience;
  voters: ElectionVoters;
  closes_at: string | null;
  questions: QuestionInput[];
}

function cleanQuestions(input: FormInput): QuestionInput[] {
  const election = input.kind === "election";
  const questions = (input.questions ?? []).map((q) => {
    const kind: FormQuestionKind = election ? "choice" : q.kind;
    if (!QUESTION_KINDS.some((k) => k.value === kind)) throw new UserError("Unknown question type.");
    const label = String(q.label ?? "").trim().slice(0, 300);
    const options = [...new Set((q.options ?? []).map((o) => String(o).trim().slice(0, 200)).filter(Boolean))];
    if (!label) throw new UserError(election ? "Every office needs a name." : "Every question needs some text.");
    if (election && options.length < 1) throw new UserError(`Add at least one candidate for ${label}.`);
    if (!election && kindHasOptions(kind) && options.length < 2) {
      throw new UserError(`Add at least 2 choices for "${label}".`);
    }
    const maxPicks = election ? Math.min(Math.max(1, Math.floor(Number(q.max_picks) || 1)), options.length) : 1;
    return {
      label,
      kind,
      help: String(q.help ?? "").trim().slice(0, 500),
      required: election ? false : Boolean(q.required),
      options: kindHasOptions(kind) ? options : [],
      max_picks: maxPicks,
    };
  });
  if (questions.length === 0) throw new UserError(election ? "Add at least one office." : "Add at least one question.");
  if (questions.length > 100) throw new UserError("That's too many questions (100 at most).");
  return questions;
}

async function hasAnswers(supabase: Supabase, formId: string): Promise<boolean> {
  const [{ count: responses }, { count: votes }] = await Promise.all([
    supabase.from("form_responses").select("id", { count: "exact", head: true }).eq("form_id", formId),
    supabase.from("election_voters").select("voter_id", { count: "exact", head: true }).eq("form_id", formId),
  ]);
  return (responses ?? 0) + (votes ?? 0) > 0;
}

// Create a form or election, or change one. Once anyone has answered or
// voted, only the title, description, audience and closing time can change.
export async function saveForm(input: FormInput) {
  return tryAction(async () => {
    const supabase = await createClient();
    const user = await signedIn(supabase);

    const title = String(input.title ?? "").trim().slice(0, 200);
    if (!title) throw new UserError("Give it a title.");
    const kind = input.kind === "election" ? "election" : "form";
    const audience = FORM_AUDIENCES.some((a) => a.value === input.audience) ? input.audience : "everyone";
    const voters = ELECTION_VOTERS.some((v) => v.value === input.voters) ? input.voters : "everyone";
    let closesAt: string | null = null;
    if (input.closes_at) {
      const d = new Date(input.closes_at);
      if (Number.isNaN(d.getTime())) throw new UserError("That closing time isn't a real date.");
      closesAt = d.toISOString();
    }
    if (kind === "election" && !closesAt) throw new UserError("Elections need a closing time.");
    const fields = {
      title,
      description: String(input.description ?? "").trim().slice(0, 5000) || null,
      audience,
      voters,
      closes_at: closesAt,
    };

    let formId = input.id;
    let locked = false;
    if (formId) {
      await requireManager(supabase, formId);
      locked = await hasAnswers(supabase, formId);
      const { error } = await supabase.from("forms").update(fields).eq("id", formId);
      if (error) throw new Error(error.message);
    } else {
      const { data: me } = await supabase.from("profiles").select("role, is_board_member").eq("id", user.id).single();
      const profile = me as { role: string; is_board_member: boolean } | null;
      if (kind === "election" ? !canCreateElections(profile) : !canCreateForms(profile)) {
        throw new UserError(
          kind === "election"
            ? "Only admins and board members can run elections."
            : "Only admins, coaches and board members can make forms."
        );
      }
      // No .select() after the insert: returning the row would re-check it
      // against can_see_form() before it's visible (see app/polls/actions.ts).
      formId = crypto.randomUUID();
      const { error } = await supabase.from("forms").insert({ id: formId, kind, created_by: user.id, ...fields });
      if (error) throw new Error(error.message);
    }

    if (!locked) {
      const questions = cleanQuestions({ ...input, kind });
      if (input.id) {
        const { error } = await supabase.from("form_questions").delete().eq("form_id", formId);
        if (error) throw new Error(error.message);
      }
      const { error } = await supabase
        .from("form_questions")
        .insert(questions.map((q, i) => ({ ...q, help: q.help || null, form_id: formId, position: i })));
      if (error) throw new Error(error.message);
    }

    if (!input.id) {
      const id = formId;
      after(async () => {
        const clubId = await clubIdOf(createAdminClient(), user.id);
        const ids = (await formAudienceIds(clubId, audience)).filter((x) => x !== user.id);
        await sendPush(ids, {
          kind: "form_new",
          title: kind === "election" ? `Vote: ${title}` : `New form: ${title}`,
          body: kind === "election" ? "An election is open. Tap to vote." : "Tap to fill it in.",
          url: `/forms/${id}`,
          tag: `form-${id}`,
        });
      });
    }

    refresh(formId);
    return { id: formId };
  });
}

export async function closeForm(formId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireManager(supabase, formId);
    const { error } = await supabase.from("forms").update({ closed_at: new Date().toISOString() }).eq("id", formId);
    if (error) throw new Error(error.message);
    refresh(formId);
  });
}

// Reopening also clears a closing time that's already passed.
export async function reopenForm(formId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireManager(supabase, formId);
    const { data } = await supabase.from("forms").select("closes_at").eq("id", formId).single();
    const closesAt = (data as Pick<Form, "closes_at"> | null)?.closes_at ?? null;
    const update: Partial<Form> = { closed_at: null };
    if (closesAt && new Date(closesAt) <= new Date()) update.closes_at = null;
    const { error } = await supabase.from("forms").update(update).eq("id", formId);
    if (error) throw new Error(error.message);
    refresh(formId);
  });
}

export async function deleteForm(formId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const user = await requireManager(supabase, formId);
    const { error } = await supabase.from("forms").delete().eq("id", formId);
    if (error) throw new Error(error.message);
    await removeFolder(`${await clubIdOf(createAdminClient(), user.id)}/${formId}`);
    refresh();
  });
}

// Every file under a folder in "form-files" (folders are club/form/person).
async function removeFolder(prefix: string) {
  const bucket = createAdminClient().storage.from("form-files");
  const { data: people } = await bucket.list(prefix, { limit: 1000 });
  const paths: string[] = [];
  for (const entry of people ?? []) {
    const { data: files } = await bucket.list(`${prefix}/${entry.name}`, { limit: 1000 });
    for (const f of files ?? []) paths.push(`${prefix}/${entry.name}/${f.name}`);
  }
  if (paths.length) await bucket.remove(paths);
}

async function loadOpenForm(supabase: Supabase, formId: string) {
  const [{ data: formData }, { data: questionData }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", formId).maybeSingle(),
    supabase.from("form_questions").select("*").eq("form_id", formId).order("position"),
  ]);
  const form = formData as Form | null;
  if (!form) throw new UserError("That form isn't there any more.");
  const { data: open } = await supabase.rpc("form_is_open", { p_form: formId });
  if (!open) throw new UserError("This form has closed.");
  return { form, questions: (questionData as FormQuestion[] | null) ?? [] };
}

// A place to upload one file answer, straight from the phone to storage
// (server actions can't take more than 4MB). The path goes in the answers.
export async function formFileUploadUrl(formId: string, questionId: string, fileName: string, size: number) {
  return tryAction(async () => {
    const supabase = await createClient();
    const user = await signedIn(supabase);
    const { form, questions } = await loadOpenForm(supabase, formId);
    if (!questions.some((q) => q.id === questionId && q.kind === "file")) throw new UserError("That question doesn't take files.");
    if (size > FILE_LIMIT) throw new UserError("That file is too big (10MB at most).");
    const name = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80) || "file";
    const path = `${form.club_id}/${formId}/${user.id}/${Date.now()}-${name}`;
    const { data, error } = await createAdminClient().storage.from("form-files").createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "No upload link.");
    return { path, token: data.token };
  });
}

export async function submitResponse(formId: string, raw: Record<string, string | string[]>) {
  return tryAction(async () => {
    const supabase = await createClient();
    const user = await signedIn(supabase);
    const { form, questions } = await loadOpenForm(supabase, formId);
    if (form.kind !== "form") throw new UserError("Use the ballot to vote.");

    const answers: Record<string, string | string[]> = {};
    for (const q of questions) {
      const value = raw?.[q.id];
      if (q.kind === "checkboxes") {
        const picks = (Array.isArray(value) ? value : []).filter((v) => q.options.includes(v));
        if (picks.length) answers[q.id] = picks;
      } else {
        const text = (Array.isArray(value) ? "" : String(value ?? "")).trim().slice(0, 5000);
        if (!text) {
          // nothing
        } else if (q.kind === "choice" && !q.options.includes(text)) {
          throw new UserError(`Pick one of the choices for "${q.label}".`);
        } else if (q.kind === "yes_no" && text !== "Yes" && text !== "No") {
          throw new UserError(`Answer yes or no for "${q.label}".`);
        } else if (q.kind === "number" && !Number.isFinite(Number(text))) {
          throw new UserError(`"${q.label}" needs a number.`);
        } else if (q.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          throw new UserError(`"${q.label}" needs a date.`);
        } else if (q.kind === "file" && !text.startsWith(`${form.club_id}/${formId}/${user.id}/`)) {
          throw new UserError(`Upload the file for "${q.label}" again.`);
        } else {
          answers[q.id] = text;
        }
      }
      if (q.required && answers[q.id] === undefined) throw new UserError(`"${q.label}" needs an answer.`);
    }

    const { data: existing } = await supabase
      .from("form_responses")
      .select("id, answers")
      .eq("form_id", formId)
      .eq("respondent_id", user.id)
      .maybeSingle();
    const prior = existing as { id: string; answers: Record<string, string | string[]> } | null;
    const { error } = prior
      ? await supabase
          .from("form_responses")
          .update({ answers, updated_at: new Date().toISOString() })
          .eq("id", prior.id)
      : await supabase.from("form_responses").insert({ form_id: formId, respondent_id: user.id, answers });
    if (error) throw new Error(error.message);

    // Files they swapped out.
    if (prior) {
      const kept = new Set(Object.values(answers).flat());
      const old = questions
        .filter((q) => q.kind === "file")
        .map((q) => prior.answers[q.id])
        .filter((p): p is string => typeof p === "string" && !kept.has(p));
      if (old.length) await createAdminClient().storage.from("form-files").remove(old);
    }
    refresh(formId);
  });
}

export async function withdrawResponse(formId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const user = await signedIn(supabase);
    await loadOpenForm(supabase, formId);
    const { data } = await supabase
      .from("form_responses")
      .delete()
      .eq("form_id", formId)
      .eq("respondent_id", user.id)
      .select("answers");
    const files = ((data as { answers: Record<string, unknown> }[] | null) ?? [])
      .flatMap((r) => Object.values(r.answers))
      .filter((v): v is string => typeof v === "string" && v.includes(`/${formId}/${user.id}/`));
    if (files.length) await createAdminClient().storage.from("form-files").remove(files);
    refresh(formId);
  });
}

// picks: {question id: [candidate, ...]}. cast_ballot() checks everything
// and stores the ballot with no name on it.
export async function castBallot(formId: string, picks: Record<string, string[]>) {
  return tryAction(async () => {
    const supabase = await createClient();
    await signedIn(supabase);
    const { error } = await supabase.rpc("cast_ballot", { p_form: formId, p_picks: picks });
    if (error) {
      if (error.code === "P0001") throw new UserError(error.message);
      throw new Error(error.message);
    }
    refresh(formId);
  });
}

const REMIND_EVERY_MS = 12 * 60 * 60 * 1000;

// "Remind them": a phone alert to everyone who hasn't answered or voted yet,
// at most every 12 hours (0119).
export async function remindForm(formId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    await requireManager(supabase, formId);
    const { data } = await supabase.from("forms").select("*").eq("id", formId).single();
    const form = data as Form | null;
    if (!form) throw new UserError("That form isn't there any more.");
    const { data: open } = await supabase.rpc("form_is_open", { p_form: formId });
    if (!open) throw new UserError("It's closed, so there's nobody to remind.");
    if (form.reminded_at && Date.now() - new Date(form.reminded_at).getTime() < REMIND_EVERY_MS) {
      throw new UserError("A reminder went out in the last 12 hours. Try again later.");
    }
    const { pending } = await formPending(createAdminClient(), form);
    if (pending.length === 0) throw new UserError("Everyone has already answered.");
    const { error } = await supabase.from("forms").update({ reminded_at: new Date().toISOString() }).eq("id", formId);
    if (error) throw new Error(error.message);
    after(() => sendFormReminder(form, pending, false));
    refresh(formId);
    return { count: pending.length };
  });
}
