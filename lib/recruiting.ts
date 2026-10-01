// College recruiting (0121): rowers and coxswains opt in to being listed for
// approved college coaches, choosing which fields they see. Name, club and
// role are always shown; contact details, address, birthday and medical
// information never are.

export const RECRUITING_KEY = "recruiting"; // club_settings: "on" or absent

export const RECRUIT_FIELDS = [
  { key: "photo", label: "Photo" },
  { key: "grad_year", label: "Graduation year" },
  { key: "high_school", label: "High school" },
  { key: "side", label: "Side (port or starboard)" },
  { key: "height", label: "Height" },
  { key: "weight", label: "Weight" },
  { key: "erg_2k", label: "2K erg time" },
  { key: "erg_5k", label: "5K erg time" },
  { key: "gpa", label: "GPA" },
  { key: "intended_major", label: "Intended major" },
  { key: "about", label: "About me" },
  { key: "video", label: "Video link" },
] as const;
export type RecruitField = (typeof RECRUIT_FIELDS)[number]["key"];
export const DEFAULT_RECRUIT_FIELDS: RecruitField[] = ["photo", "grad_year", "high_school", "side", "erg_2k"];

export function cleanRecruitFields(values: unknown[]): RecruitField[] {
  const known: readonly string[] = RECRUIT_FIELDS.map((f) => f.key);
  return [...new Set(values.map(String).filter((v) => known.includes(v)))] as RecruitField[];
}

export type RecruitListing = {
  profile_id: string;
  club_id: string;
  shown: boolean;
  fields: string[];
  height: string | null;
  gpa: string | null;
  intended_major: string | null;
  about: string | null;
  video_url: string | null;
  parent_approved_at: string | null;
  parent_approved_by: string | null;
  updated_at: string;
};

// 18 or over by the birthday on file. No birthday counts as under 18.
export function isAdult(birthday: string | null, today: Date = new Date()): boolean {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false;
  const [y, m, d] = birthday.split("-").map(Number);
  return new Date(y + 18, m - 1, d) <= today;
}

export type ListingProfile = {
  role: string;
  birthday: string | null;
  approved_at: string | null;
  disabled_at: string | null;
};

// Why a listing isn't showing to college coaches, or null if it is.
export function listingBlocker(
  listing: Pick<RecruitListing, "shown" | "parent_approved_at"> | null,
  profile: ListingProfile,
  clubOn: boolean
): string | null {
  if (!clubOn) return "Your club hasn't turned on college recruiting.";
  if (profile.role !== "rower" && profile.role !== "coxswain") return "Only rowers and coxswains can be listed.";
  if (!profile.approved_at || profile.disabled_at) return "Only current members can be listed.";
  if (!listing?.shown) return "Not listed.";
  if (!isAdult(profile.birthday) && !listing.parent_approved_at) return "Waiting for a parent or guardian to approve.";
  return null;
}

export const SIDE_LABEL: Record<string, string> = { port: "Port", starboard: "Starboard", either: "Either side" };
