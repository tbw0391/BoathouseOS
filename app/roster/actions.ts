"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role, BoatSide, Team } from "@/lib/database.types";

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
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const displayName = `${firstName} ${lastName}`.trim();
  const role = String(formData.get("role") ?? "rower") as Role;
  const boatSideRaw = String(formData.get("boat_side") ?? "");
  const boatSide = (boatSideRaw || null) as BoatSide | null;
  const teamRaw = String(formData.get("team") ?? "");
  const team = (teamRaw || null) as Team | null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!email || !firstName || !lastName) {
    throw new Error("First name, last name, and email are required.");
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
    first_name: firstName,
    last_name: lastName,
    role,
    boat_side: boatSide,
    team,
    phone,
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  revalidatePath("/roster");
  return { inviteLink: linkData.properties.action_link };
}
