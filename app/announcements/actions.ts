"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { activeMemberIds, sendPush } from "@/lib/push";
import type { AnnouncementAudience } from "@/lib/database.types";
import { UserError } from "@/lib/userError";

const VALID_AUDIENCES: AnnouncementAudience[] = ["rowers", "parents", "both"];

async function requireCoachOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const callerRole = (callerProfile as { role: string } | null)?.role;
  if (callerRole !== "coach" && callerRole !== "admin") {
    throw new UserError("Only coaches and admins can send announcements.");
  }

  return user;
}

export async function sendAnnouncement(formData: FormData) {
  const supabase = await createClient();
  const user = await requireCoachOrAdmin(supabase);

  const message = String(formData.get("message") ?? "").trim();
  if (!message) throw new UserError("Write a message first.");

  const audience = String(formData.get("audience") ?? "");
  if (!VALID_AUDIENCES.includes(audience as AnnouncementAudience)) {
    throw new UserError("Please choose who this message is for.");
  }

  const { error } = await supabase
    .from("coach_announcements")
    .insert({ sender_id: user.id, message, audience });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/announcements");

  // Same people who get the home-page banner.
  const roles =
    audience === "rowers"
      ? ["rower", "coxswain"]
      : audience === "parents"
        ? ["parent"]
        : ["rower", "coxswain", "parent"];
  after(async () => {
    const { data: sender } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    await sendPush(await activeMemberIds(roles), {
      kind: "announcement",
      title: `Announcement from ${(sender as { display_name: string } | null)?.display_name ?? "your coach"}`,
      body: message.length > 140 ? `${message.slice(0, 139)}…` : message,
      url: "/",
    });
  });
}

export async function deleteAnnouncement(announcementId: string) {
  const supabase = await createClient();
  await requireCoachOrAdmin(supabase);

  const { error } = await supabase.from("coach_announcements").delete().eq("id", announcementId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/announcements");
}
