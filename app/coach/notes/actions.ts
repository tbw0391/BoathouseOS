"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UserError, tryAction } from "@/lib/userError";

async function requireCoach() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (data as { role: string } | null)?.role;
  if (role !== "coach" && role !== "admin") throw new UserError("Only coaches and admins can write coach notes.");
  return { supabase, user };
}

// A note about one athlete, or (no athlete) on a practice day's shared notes.
export async function addCoachNote(input: { athleteId: string | null; noteDate: string | null; body: string }) {
  return tryAction(async () => {
    const { supabase, user } = await requireCoach();
    const body = input.body.trim().slice(0, 4000);
    if (!body) throw new UserError("Write a note first.");
    const noteDate = input.noteDate && /^\d{4}-\d{2}-\d{2}$/.test(input.noteDate) ? input.noteDate : null;
    if (!input.athleteId && !noteDate) throw new UserError("Missing the athlete or practice day.");
    const { data, error } = await supabase
      .from("coach_notes")
      .insert({ athlete_id: input.athleteId, note_date: noteDate, body, created_by: user.id })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/coach/notes");
    return data;
  });
}

export async function deleteCoachNote(id: string) {
  return tryAction(async () => {
    const { supabase } = await requireCoach();
    const { error } = await supabase.from("coach_notes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/coach/notes");
  });
}
