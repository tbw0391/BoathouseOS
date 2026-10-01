import { createClient } from "@/lib/supabase/server";
import type { Form, FormQuestion, FormResponse } from "@/lib/database.types";
import { answerText } from "@/lib/forms";

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// A form's responses as a spreadsheet, for whoever manages it.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: canManage } = await supabase.rpc("can_manage_form", { p_form: id });
  if (!canManage) return new Response("Not allowed.", { status: 403 });

  const [{ data: formData }, { data: questionData }, { data: responseRows }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", id).single(),
    supabase.from("form_questions").select("*").eq("form_id", id).order("position"),
    supabase.from("form_responses").select("*").eq("form_id", id).order("submitted_at"),
  ]);
  const form = formData as Form | null;
  if (!form || form.kind !== "form") return new Response("Not found.", { status: 404 });
  const questions = (questionData as FormQuestion[] | null) ?? [];
  const responses = (responseRows as FormResponse[] | null) ?? [];
  const { data: nameRows } = responses.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in(
          "id",
          responses.map((r) => r.respondent_id)
        )
    : { data: [] };
  const people = new Map(
    ((nameRows as { id: string; display_name: string; email: string }[] | null) ?? []).map((p) => [p.id, p])
  );

  const lines = [
    ["Name", "Email", "Sent", ...questions.map((q) => q.label)].map(csvCell).join(","),
    ...responses.map((r) =>
      [
        people.get(r.respondent_id)?.display_name ?? "",
        people.get(r.respondent_id)?.email ?? "",
        new Date(r.updated_at).toLocaleString("en-US", { timeZone: "America/New_York" }),
        ...questions.map((q) => answerText(q, r.answers[q.id])),
      ]
        .map(csvCell)
        .join(",")
    ),
  ];
  const filename = `${form.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "form"}.csv`;
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
