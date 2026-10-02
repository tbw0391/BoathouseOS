"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UserError, tryAction } from "@/lib/userError";

// A parent's (or an admin recording a paper form) yearly SafeSport travel
// consent (0127). Saving restarts the year; unticking both withdraws it.
// The database lets only the rower's guardians and admins do this.
export async function saveTravelConsent(rowerId: string, clubTravel: boolean, oneOnOne: boolean) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");

    if (!clubTravel && !oneOnOne) {
      const { error } = await supabase.from("transport_consents").delete().eq("rower_id", rowerId);
      if (error) throw new Error(error.message);
    } else {
      const { data: me } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      const now = new Date();
      const expires = new Date(now);
      expires.setFullYear(expires.getFullYear() + 1);
      const { error } = await supabase.from("transport_consents").upsert({
        rower_id: rowerId,
        club_travel: clubTravel,
        one_on_one: oneOnOne,
        given_by: user.id,
        given_by_name: (me as { display_name: string } | null)?.display_name ?? "",
        given_at: now.toISOString(),
        expires_on: expires.toISOString().slice(0, 10),
      });
      if (error?.code === "42501") throw new UserError("Only this rower's parent or an admin can give travel consent.");
      if (error) throw new Error(error.message);
    }
    revalidatePath(`/roster/${rowerId}`);
  });
}
