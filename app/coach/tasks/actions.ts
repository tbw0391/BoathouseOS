"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = callerProfile as { role: string } | null;
  if (profile?.role !== "admin" && profile?.role !== "coach") {
    throw new Error("Only coaches and admins can do that.");
  }

  return { user, supabase };
}

export async function createTaskType(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const { error } = await supabase.from("task_types").insert({ name, created_by: user.id });
  if (error) {
    if (error.code === "23505") throw new Error(`"${name}" already exists.`);
    throw new Error(error.message);
  }

  revalidatePath("/coach/tasks");
}

export async function deleteTaskType(typeId: string) {
  const supabase = await createClient();
  await requireManager(supabase);

  const { error } = await supabase.from("task_types").delete().eq("id", typeId);
  if (error) {
    if (error.code === "23503") {
      throw new Error("Can't delete a task type that's still used by a task.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/coach/tasks");
}

export async function createCoachTask(formData: FormData) {
  const supabase = await createClient();
  const { user } = await requireManager(supabase);

  const eventId = String(formData.get("event_id") ?? "").trim();
  const taskTypeId = String(formData.get("task_type_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!eventId || !taskTypeId) throw new Error("Task type is required.");

  const { error } = await supabase.from("coach_tasks").insert({
    event_id: eventId,
    task_type_id: taskTypeId,
    notes,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/coach/tasks");
  revalidatePath("/");
}

export async function updateCoachTask(formData: FormData) {
  const supabase = await createClient();
  await requireManager(supabase);

  const taskId = String(formData.get("task_id") ?? "").trim();
  const taskTypeId = String(formData.get("task_type_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!taskId || !taskTypeId) throw new Error("Task type is required.");

  const { error } = await supabase
    .from("coach_tasks")
    .update({ task_type_id: taskTypeId, notes })
    .eq("id", taskId);

  if (error) throw new Error(error.message);

  revalidatePath("/coach/tasks");
  revalidatePath("/");
}

export async function deleteCoachTask(taskId: string) {
  const supabase = await createClient();
  await requireManager(supabase);

  const { error } = await supabase.from("coach_tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);

  revalidatePath("/coach/tasks");
  revalidatePath("/");
}

export async function assignRowerToTask(taskId: string, userId: string) {
  const supabase = await createClient();
  await requireManager(supabase);

  if (!taskId || !userId) throw new Error("Missing task or rower.");

  const { error } = await supabase
    .from("coach_task_assignments")
    .upsert({ task_id: taskId, user_id: userId }, { onConflict: "task_id,user_id" });

  if (error) throw new Error(error.message);

  revalidatePath("/coach/tasks");
  revalidatePath("/");
}

export async function unassignRowerFromTask(taskId: string, userId: string) {
  const supabase = await createClient();
  await requireManager(supabase);

  if (!taskId || !userId) throw new Error("Missing task or rower.");

  const { error } = await supabase
    .from("coach_task_assignments")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  revalidatePath("/coach/tasks");
  revalidatePath("/");
}
