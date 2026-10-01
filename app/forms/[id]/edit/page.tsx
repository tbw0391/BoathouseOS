import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Form, FormQuestion } from "@/lib/database.types";
import { FormBuilder } from "../../FormBuilder";

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Once anyone has answered or voted, the questions are locked.
  const [{ count: responses }, { count: votes }] = await Promise.all([
    supabase.from("form_responses").select("id", { count: "exact", head: true }).eq("form_id", id),
    supabase.from("election_voters").select("voter_id", { count: "exact", head: true }).eq("form_id", id),
  ]);

  return (
    <div className="min-h-screen p-8 max-w-lg mx-auto flex flex-col gap-4">
      <Link href={`/forms/${id}`} className="text-sm text-gray-500 hover:underline">
        ← {form.title}
      </Link>
      <h1 className="text-2xl font-bold">Edit {form.kind === "election" ? "election" : "form"}</h1>
      <FormBuilder
        locked={(responses ?? 0) + (votes ?? 0) > 0}
        initial={{
          id,
          kind: form.kind,
          title: form.title,
          description: form.description ?? "",
          audience: form.audience,
          voters: form.voters,
          closes_at: form.closes_at,
          questions: ((questionData as FormQuestion[] | null) ?? []).map((q) => ({
            label: q.label,
            kind: q.kind,
            help: q.help ?? "",
            required: q.required,
            options: q.options,
            max_picks: q.max_picks,
          })),
        }}
      />
    </div>
  );
}
