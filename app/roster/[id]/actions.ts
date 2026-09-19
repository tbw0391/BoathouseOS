"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BoatSide, Team } from "@/lib/database.types";

export async function updateBio(profileId: string, formData: FormData) {
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

  const callerRole = (callerProfile as { role: string } | null)?.role;
  const isSelf = user.id === profileId;
  const isStaff = callerRole === "admin" || callerRole === "coach";
  if (!isSelf && !isStaff) {
    throw new Error("You can only edit your own bio.");
  }

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const highSchool = String(formData.get("high_school") ?? "").trim() || null;
  const gradYearRaw = String(formData.get("grad_year") ?? "").trim();
  const gradYear = gradYearRaw ? Number(gradYearRaw) : null;
  const funFact = String(formData.get("fun_fact") ?? "").trim() || null;
  const birthday = String(formData.get("birthday") ?? "").trim() || null;
  const boatSideRaw = String(formData.get("boat_side") ?? "");
  const boatSide = (boatSideRaw || null) as BoatSide | null;
  const teamRaw = String(formData.get("team") ?? "");
  const team = (teamRaw || null) as Team | null;
  const photoUrl = String(formData.get("photo_url") ?? "").trim() || null;

  if (!firstName || !lastName) {
    throw new Error("First and last name are required.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      display_name: `${firstName} ${lastName}`.trim(),
      address,
      phone,
      high_school: highSchool,
      grad_year: gradYear,
      fun_fact: funFact,
      birthday,
      boat_side: boatSide,
      team,
      photo_url: photoUrl,
    })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  revalidatePath(`/roster/${profileId}`);
  revalidatePath("/roster");
}
