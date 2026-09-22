"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AnnouncementAudience } from "@/lib/database.types";

const VALID_AUDIENCES: AnnouncementAudience[] = ["rowers", "parents", "both"];

async function requireCoachOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "coach" && callerRole !== "admin") {
    throw new Error("Only coaches and admins can send announcements.");
  }

  return user;
}

export async function sendAnnouncement(formData: FormData) {
  const supabase = await createClient();
  const user = await requireCoachOrAdmin(supabase);

  const message = String(formData.get("message") ?? "").trim();
  if (!message) throw new Error("Write a message first.");

  const audience = String(formData.get("audience") ?? "");
  if (!VALID_AUDIENCES.includes(audience as AnnouncementAudience)) {
    throw new Error("Please choose who this message is for.");
  }

  const { error } = await supabase
    .from("coach_announcements")
    .insert({ sender_id: user.id, message, audience });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/announcements");
}

export async function deleteAnnouncement(announcementId: string) {
  const supabase = await createClient();
  await requireCoachOrAdmin(supabase);

  const { error } = await supabase.from("coach_announcements").delete().eq("id", announcementId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/announcements");
}
