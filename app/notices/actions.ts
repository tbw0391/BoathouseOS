"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Hides a BoathouseOS announcement (0107) for the signed-in member.
export async function dismissNotice(noticeId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_notice_dismissals")
    .upsert({ notice_id: noticeId }, { onConflict: "notice_id,user_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
