"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { EMERGENCY_TEXT_FIELDS } from "@/lib/emergencyInfo";
import { UserError } from "@/lib/userError";

// RLS allows the member, their guardians, coaches and admins.
export async function saveEmergencyInfo(profileId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");

  const row: Record<string, string | null> = {};
  for (const f of EMERGENCY_TEXT_FIELDS) {
    const max = f.endsWith("_phone") ? 30 : f.endsWith("_name") || f.endsWith("_relation") ? 80 : 1000;
    row[f] = String(formData.get(f) ?? "").trim().slice(0, max) || null;
  }
  const { error } = await supabase.from("emergency_info").upsert({
    profile_id: profileId,
    ...row,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) throw new UserError("Couldn't save. Only this member, their parents and the coaches can change it.");
  revalidatePath(`/roster/${profileId}`);
  revalidatePath("/coach/emergency");
}
