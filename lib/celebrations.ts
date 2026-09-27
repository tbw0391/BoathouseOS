import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ErgTime, Profile } from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type BirthdayPerson = Pick<Profile, "id" | "display_name" | "first_name">;

// Active members whose birthday is today (Eastern). Feb 29 birthdays show on
// Feb 28 in non-leap years.
export async function loadBirthdaysToday(supabase: Supabase): Promise<BirthdayPerson[]> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const [year, monthDay] = [Number(today.slice(0, 4)), today.slice(5)];
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, first_name, birthday")
    .not("birthday", "is", null)
    .not("approved_at", "is", null)
    .is("disabled_at", null);

  return ((data as (BirthdayPerson & { birthday: string })[] | null) ?? [])
    .filter((p) => {
      const md = p.birthday.slice(5, 10);
      return md === monthDay || (!isLeap && md === "02-29" && monthDay === "02-28");
    })
    .map(({ id, display_name, first_name }) => ({ id, display_name, first_name }));
}

export type PrBanner = Pick<ErgTime, "id" | "distance" | "time_text" | "seconds" | "previous_best_seconds">;

// This person's PRs from the last 7 days, newest per distance.
export async function loadMyRecentPrs(supabase: Supabase, userId: string): Promise<PrBanner[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("erg_times")
    .select("id, distance, time_text, seconds, previous_best_seconds")
    .eq("profile_id", userId)
    .eq("is_pr", true)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false });

  const seen = new Set<string>();
  return ((data as PrBanner[] | null) ?? []).filter((pr) => {
    if (seen.has(pr.distance)) return false;
    seen.add(pr.distance);
    return true;
  });
}

// 408.3 -> "6:48.3"
export function formatErgSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  const [whole, tenths] = seconds.toFixed(1).split(".");
  return `${minutes}:${whole.padStart(2, "0")}${tenths === "0" ? "" : `.${tenths}`}`;
}
