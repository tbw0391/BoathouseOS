"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UserError, tryAction } from "@/lib/userError";

// Makes (or, with reset, replaces) the signed-in member's calendar feed token.
export async function getCalendarFeedToken(reset = false) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    if (reset) await supabase.from("calendar_feeds").delete().eq("profile_id", user.id);
    const { data: existing } = await supabase
      .from("calendar_feeds")
      .select("token")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (existing) return (existing as { token: string }).token;

    const { data, error } = await supabase
      .from("calendar_feeds")
      .insert({ profile_id: user.id })
      .select("token")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/schedule");
    return (data as { token: string }).token;
  });
}
