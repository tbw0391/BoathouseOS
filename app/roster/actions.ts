"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role, BoatSide } from "@/lib/database.types";

export async function addMember(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const callerRole = (callerProfile as { role: Role } | null)?.role;
  if (callerRole !== "admin" && callerRole !== "coach") {
    throw new Error("Only coaches and admins can add members.");
  }

  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const role = String(formData.get("role") ?? "rower") as Role;
  const boatSideRaw = String(formData.get("boat_side") ?? "");
  const boatSide = (boatSideRaw || null) as BoatSide | null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!email || !displayName) {
    throw new Error("Name and email are required.");
  }

  const admin = createAdminClient();

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
  });

  if (linkError || !linkData.user) {
    throw new Error(linkError?.message ?? "Failed to create user.");
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: linkData.user.id,
    email,
    display_name: displayName,
    role,
    boat_side: boatSide,
    phone,
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  revalidatePath("/roster");
  return { inviteLink: linkData.properties.action_link };
}
