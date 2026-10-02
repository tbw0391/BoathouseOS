"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UserError, tryAction } from "@/lib/userError";

// A parent's written request that adults not message their child (SafeSport,
// 0123). Only the rower's guardians or an admin can make or withdraw it; the
// database checks that too, and takes the rower out of chats with adults
// right away (their parents stay in, in their place).
export async function setNoMessageRequest(rowerId: string, on: boolean) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    const { error } = on
      ? await supabase.from("no_message_requests").insert({ rower_id: rowerId, requested_by: user.id })
      : await supabase.from("no_message_requests").delete().eq("rower_id", rowerId);
    if (error?.code === "23505") return;
    if (error?.code === "42501") throw new UserError("Only this rower's parent or an admin can change this.");
    if (error) throw new Error(error.message);

    revalidatePath(`/roster/${rowerId}`);
    revalidatePath("/messages");
  });
}
