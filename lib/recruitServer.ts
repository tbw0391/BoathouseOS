import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserError } from "@/lib/userError";
import {
  RECRUITING_KEY,
  listingBlocker,
  type RecruitField,
  type RecruitListing,
} from "@/lib/recruiting";

// The recruit pages. College coaches belong to no club, so the database
// shows them nothing; these read with the service role once they've checked
// the coach is approved, and only ever return the fields an athlete chose.

type Admin = ReturnType<typeof createAdminClient>;

export type Recruiter = {
  user_id: string;
  name: string;
  email: string;
  school: string;
  title: string | null;
  status: "pending" | "approved" | "rejected";
  decided_at: string | null;
  created_at: string;
};

// The signed-in account and its college coach record, if any.
export async function recruitViewer(): Promise<{ userId: string; email: string | null; recruiter: Recruiter | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await createAdminClient().from("recruiters").select("*").eq("user_id", user.id).maybeSingle();
  return { userId: user.id, email: user.email ?? null, recruiter: (data as Recruiter | null) ?? null };
}

export async function requireApprovedRecruiter(): Promise<Recruiter> {
  const viewer = await recruitViewer();
  if (viewer?.recruiter?.status !== "approved") throw new UserError("Only approved college coaches can do that.");
  return viewer.recruiter;
}

// What a college coach sees about one athlete.
export type RecruitAthlete = {
  id: string;
  name: string;
  role: string;
  clubName: string;
  photoUrl?: string | null;
  gradYear?: number | null;
  highSchool?: string | null;
  side?: string | null;
  height?: string | null;
  weightLbs?: number | null;
  erg2k?: string | null;
  erg5k?: string | null;
  gpa?: string | null;
  intendedMajor?: string | null;
  about?: string | null;
  videoUrl?: string | null;
};

type ProfileRow = {
  id: string;
  club_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  role: string;
  birthday: string | null;
  approved_at: string | null;
  disabled_at: string | null;
  photo_url: string | null;
  grad_year: number | null;
  high_school: string | null;
  boat_side: string | null;
  weight_lbs: number | null;
  erg_2k_time: string | null;
  erg_5k_time: string | null;
};

const PROFILE_COLUMNS =
  "id, club_id, first_name, last_name, display_name, role, birthday, approved_at, disabled_at, photo_url, grad_year, high_school, boat_side, weight_lbs, erg_2k_time, erg_5k_time";

function toAthlete(p: ProfileRow, l: RecruitListing, clubName: string): RecruitAthlete {
  const has = (f: RecruitField) => l.fields.includes(f);
  const a: RecruitAthlete = {
    id: p.id,
    name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.display_name,
    role: p.role,
    clubName,
  };
  if (has("photo")) a.photoUrl = p.photo_url;
  if (has("grad_year")) a.gradYear = p.grad_year;
  if (has("high_school")) a.highSchool = p.high_school;
  if (has("side")) a.side = p.boat_side;
  if (has("height")) a.height = l.height;
  if (has("weight")) a.weightLbs = p.weight_lbs;
  if (has("erg_2k")) a.erg2k = p.erg_2k_time;
  if (has("erg_5k")) a.erg5k = p.erg_5k_time;
  if (has("gpa")) a.gpa = l.gpa;
  if (has("intended_major")) a.intendedMajor = l.intended_major;
  if (has("about")) a.about = l.about;
  if (has("video")) a.videoUrl = l.video_url;
  return a;
}

// Every athlete college coaches can see right now (or just one).
export async function listedAthletes(admin: Admin, onlyId?: string): Promise<(RecruitAthlete & { clubId: string })[]> {
  const { data: settingRows } = await admin.from("club_settings").select("club_id").eq("key", RECRUITING_KEY).eq("value", "on");
  const clubIds = ((settingRows as { club_id: string }[] | null) ?? []).map((r) => r.club_id);
  if (clubIds.length === 0) return [];

  let listingQuery = admin.from("recruit_listings").select("*").eq("shown", true).in("club_id", clubIds);
  if (onlyId) listingQuery = listingQuery.eq("profile_id", onlyId);
  const { data: listingRows } = await listingQuery;
  const listings = (listingRows as RecruitListing[] | null) ?? [];
  if (listings.length === 0) return [];

  const [{ data: profileRows }, { data: clubRows }] = await Promise.all([
    admin.from("profiles").select(PROFILE_COLUMNS).in("id", listings.map((l) => l.profile_id)),
    admin.from("clubs").select("id, name, suspended_at").in("id", clubIds),
  ]);
  const profiles = new Map(((profileRows as ProfileRow[] | null) ?? []).map((p) => [p.id, p]));
  const clubs = new Map(
    ((clubRows as { id: string; name: string; suspended_at: string | null }[] | null) ?? [])
      .filter((c) => !c.suspended_at)
      .map((c) => [c.id, c.name])
  );

  return listings.flatMap((l) => {
    const p = profiles.get(l.profile_id);
    const clubName = clubs.get(l.club_id);
    if (!p || !clubName || listingBlocker(l, p, true)) return [];
    return [{ ...toAthlete(p, l, clubName), clubId: l.club_id }];
  });
}
