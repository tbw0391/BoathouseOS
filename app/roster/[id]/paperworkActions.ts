"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PAPERWORK } from "@/lib/paperwork";

const dateOrNull = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// RLS allows the member, their guardians, coaches and admins; a trigger
// marks it checked when a coach or admin saves.
export async function savePaperwork(profileId: string, kind: string, completedOn: string, expiresOn: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  if (!PAPERWORK.some((p) => p.kind === kind)) throw new Error("Unknown paperwork.");

  const completed = dateOrNull(completedOn);
  const expires = dateOrNull(expiresOn);
  const { error } =
    completed || expires
      ? await supabase
          .from("member_paperwork")
          .upsert({ profile_id: profileId, kind, completed_on: completed, expires_on: expires })
      : await supabase.from("member_paperwork").delete().eq("profile_id", profileId).eq("kind", kind);
  if (error) throw new Error("Couldn't save. Only this member, their parents and the coaches can change it.");
  revalidatePath(`/roster/${profileId}`);
  revalidatePath("/coach/paperwork");
}
