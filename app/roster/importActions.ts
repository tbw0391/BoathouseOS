"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role, BoatSide, Team } from "@/lib/database.types";

const VALID_ROLES: Role[] = ["rower", "coxswain", "coach", "parent", "admin"];
const VALID_BOAT_SIDES: BoatSide[] = ["port", "starboard", "either"];
const VALID_TEAMS: Team[] = [
  "mens",
  "womens",
  "development",
  "masters",
  "alumni",
  "coach",
  "parent",
];

export interface ImportRow {
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  team?: string;
  boat_side?: string;
  phone?: string;
}

export async function importMembers(rows: ImportRow[]) {
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
    throw new Error("Only coaches and admins can import members.");
  }

  const toInsert: Record<string, unknown>[] = [];
  const teamsToInsert: Team[][] = [];
  const rowErrors: string[] = [];

  rows.forEach((row, i) => {
    const firstName = String(row.first_name ?? "").trim();
    const lastName = String(row.last_name ?? "").trim();
    const email = String(row.email ?? "").trim();
    const rowLabel = `Row ${i + 2}`; // +2: header row + 1-index

    if (!firstName || !lastName || !email) {
      rowErrors.push(`${rowLabel}: missing first name, last name, or email.`);
      return;
    }

    const roleRaw = String(row.role ?? "rower").trim().toLowerCase();
    const role = VALID_ROLES.includes(roleRaw as Role) ? (roleRaw as Role) : "rower";
    if (row.role && !VALID_ROLES.includes(roleRaw as Role)) {
      rowErrors.push(`${rowLabel}: unknown role "${row.role}", defaulted to rower.`);
    }

    const teamTokens = String(row.team ?? "")
      .split(/[,;]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const teams: Team[] = [];
    for (const token of teamTokens) {
      if (VALID_TEAMS.includes(token as Team)) {
        teams.push(token as Team);
      } else {
        rowErrors.push(`${rowLabel}: unknown group "${token}", skipped.`);
      }
    }

    const boatSideRaw = String(row.boat_side ?? "").trim().toLowerCase();
    const boatSide = VALID_BOAT_SIDES.includes(boatSideRaw as BoatSide)
      ? (boatSideRaw as BoatSide)
      : null;

    toInsert.push({
      first_name: firstName,
      last_name: lastName,
      display_name: `${firstName} ${lastName}`.trim(),
      email,
      role,
      boat_side: boatSide,
      phone: String(row.phone ?? "").trim() || null,
    });
    teamsToInsert.push(teams);
  });

  if (toInsert.length === 0) {
    return { imported: 0, errors: rowErrors.length ? rowErrors : ["No valid rows found."] };
  }

  const admin = createAdminClient();
  const { error, data } = await admin.from("profiles").insert(toInsert).select("id");

  if (error) {
    throw new Error(error.message);
  }

  const profileTeamRows = (data ?? []).flatMap((profile, i) =>
    teamsToInsert[i].map((team) => ({ profile_id: profile.id, team }))
  );
  if (profileTeamRows.length > 0) {
    const { error: teamsError } = await admin.from("profile_teams").insert(profileTeamRows);
    if (teamsError) throw new Error(teamsError.message);
  }

  revalidatePath("/roster");
  return { imported: data?.length ?? 0, errors: rowErrors };
}
