"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UserError, tryAction } from "@/lib/userError";
import { slugify } from "@/lib/website";
import { PROGRAM_QUESTION_KINDS, type ProgramQuestion, type RegistrationStatus } from "@/lib/programs";

// Admin Settings > Website > Programs (0117). Admins only; the database
// checks too.

async function requireAdmin() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_club_admin");
  if (!isAdmin) throw new UserError("Only admins can change programs.");
  return supabase;
}

function refresh() {
  revalidatePath("/admin/website", "layout");
  revalidatePath("/site", "layout");
}

export async function createProgram(formData: FormData) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const title = String(formData.get("title") ?? "").trim().slice(0, 120);
    if (!title) throw new UserError("Give it a name.");
    const { data: existing } = await supabase.from("programs").select("slug");
    const taken = new Set(((existing as { slug: string }[] | null) ?? []).map((r) => r.slug));
    const base = slugify(title);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const { data, error } = await supabase.from("programs").insert({ title, slug }).select("id").single();
    if (error) throw new Error(error.message);
    refresh();
    return { id: (data as { id: string }).id };
  });
}

export interface ProgramInput {
  id: string;
  title: string;
  description: string;
  starts_on: string;
  ends_on: string;
  schedule: string;
  ages: string;
  price: string;
  capacity: string;
  opens_at: string | null;
  closes_at: string | null;
  published: boolean;
  waiver: string;
  sort_order: number;
  questions: ProgramQuestion[];
}

const dateOrNull = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
const isoOrNull = (s: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const text = (s: string, max: number) => String(s ?? "").trim().slice(0, max) || null;

export async function saveProgram(input: ProgramInput) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const title = String(input.title ?? "").trim().slice(0, 120);
    if (!title) throw new UserError("Give it a name.");

    let priceCents: number | null = null;
    if (String(input.price ?? "").trim()) {
      const n = Number(String(input.price).replace(/[$,\s]/g, ""));
      if (!Number.isFinite(n) || n < 0) throw new UserError("The cost needs to be a dollar amount, like 150 or 0.");
      priceCents = Math.round(n * 100);
    }
    let capacity: number | null = null;
    if (String(input.capacity ?? "").trim()) {
      capacity = Math.floor(Number(input.capacity));
      if (!Number.isFinite(capacity) || capacity < 1) throw new UserError("Spots needs to be a number, or blank for no limit.");
    }
    const startsOn = dateOrNull(input.starts_on);
    const endsOn = dateOrNull(input.ends_on);
    if (startsOn && endsOn && endsOn < startsOn) throw new UserError("The end date is before the start date.");
    const opensAt = isoOrNull(input.opens_at);
    const closesAt = isoOrNull(input.closes_at);
    if (opensAt && closesAt && closesAt <= opensAt) throw new UserError("Registration closes before it opens.");

    const questions = (input.questions ?? []).map((q) => {
      const label = String(q.label ?? "").trim().slice(0, 300);
      if (!label) throw new UserError("Every extra question needs some text.");
      if (!PROGRAM_QUESTION_KINDS.some((k) => k.value === q.kind)) throw new UserError("Unknown question type.");
      const options = q.kind === "choice" ? [...new Set((q.options ?? []).map((o) => o.trim().slice(0, 200)).filter(Boolean))] : [];
      if (q.kind === "choice" && options.length < 2) throw new UserError(`Add at least 2 choices for "${label}".`);
      return { id: q.id || crypto.randomUUID(), label, kind: q.kind, options, required: Boolean(q.required) };
    });

    const { error } = await supabase
      .from("programs")
      .update({
        title,
        description: String(input.description ?? "").trim().slice(0, 10000),
        starts_on: startsOn,
        ends_on: endsOn,
        schedule: text(input.schedule, 200),
        ages: text(input.ages, 120),
        price_cents: priceCents,
        capacity,
        opens_at: opensAt,
        closes_at: closesAt,
        published: Boolean(input.published),
        waiver: text(input.waiver, 20000),
        sort_order: Math.floor(Number(input.sort_order) || 0),
        questions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function deleteProgram(programId: string) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("programs").delete().eq("id", programId);
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function setRegistrationStatus(formData: FormData) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const status = String(formData.get("status") ?? "") as RegistrationStatus;
    if (!["registered", "waitlist", "cancelled"].includes(status)) throw new UserError("Unknown status.");
    const { error } = await supabase
      .from("program_registrations")
      .update({ status })
      .eq("id", String(formData.get("id") ?? ""));
    if (error) throw new Error(error.message);
    refresh();
  });
}

// Paid by cash, check or however the club collects, until card payments.
export async function setRegistrationPaid(formData: FormData) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("program_registrations")
      .update({ paid_at: formData.get("paid") === "1" ? new Date().toISOString() : null })
      .eq("id", String(formData.get("id") ?? ""));
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function saveRegistrationNote(formData: FormData) {
  return tryAction(async () => {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("program_registrations")
      .update({ notes: String(formData.get("notes") ?? "").trim().slice(0, 2000) || null })
      .eq("id", String(formData.get("id") ?? ""));
    if (error) throw new Error(error.message);
    refresh();
  });
}
