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
  const teams = formData.getAll("team") as Team[];
  const photoUrl = String(formData.get("photo_url") ?? "").trim() || null;
  const erg2kTime = String(formData.get("erg_2k_time") ?? "").trim() || null;
  const erg5kTime = String(formData.get("erg_5k_time") ?? "").trim() || null;
  const usRowingNumber = String(formData.get("us_rowing_number") ?? "").trim() || null;

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
      photo_url: photoUrl,
      erg_2k_time: erg2kTime,
      erg_5k_time: erg5kTime,
      us_rowing_number: usRowingNumber,
    })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  const { error: deleteTeamsError } = await supabase
    .from("profile_teams")
    .delete()
    .eq("profile_id", profileId);
  if (deleteTeamsError) throw new Error(deleteTeamsError.message);

  if (teams.length > 0) {
    const { error: teamsError } = await supabase
      .from("profile_teams")
      .insert(teams.map((team) => ({ profile_id: profileId, team })));
    if (teamsError) throw new Error(teamsError.message);
  }

  revalidatePath(`/roster/${profileId}`);
  revalidatePath("/roster");
}

export async function setBoardMember(profileId: string, isBoardMember: boolean) {
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
  if (callerRole !== "admin") {
    throw new Error("Only admins can set board membership.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_board_member: isBoardMember })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  revalidatePath(`/roster/${profileId}`);
  revalidatePath("/roster");
}

export async function setTentLeader(profileId: string, isTentLeader: boolean) {
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
  if (callerRole !== "admin") {
    throw new Error("Only admins can set tent leaders.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_tent_leader: isTentLeader })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  revalidatePath(`/roster/${profileId}`);
  revalidatePath("/roster");
}
