import "server-only";
import { createClient } from "@/lib/supabase/server";
import { LINEUP_CATEGORIES } from "@/lib/lineupCategories";
import type { Lineup, LineupSeat, ScheduleEvent } from "@/lib/database.types";

export interface Medal {
  lineupId: string;
  place: 1 | 2 | 3;
  eventTitle: string;
  year: number;
  startsAt: string;
  artworkUrl: string | null;
  raceLabel: string | null;
}

// Every 1st-3rd place finish this person rowed or coxed in, newest first.
// A medal belongs to everyone seated in the boat, coxswain included.
export async function getMedalsForProfile(profileId: string): Promise<Medal[]> {
  const supabase = await createClient();
  const { data: seatRows } = await supabase.from("lineup_seats").select("lineup_id").eq("rower_id", profileId);
  const lineupIds = [...new Set(((seatRows as Pick<LineupSeat, "lineup_id">[] | null) ?? []).map((s) => s.lineup_id))];
  if (lineupIds.length === 0) return [];

  const { data: lineupRows } = await supabase
    .from("lineups")
    .select("id, event_id, place, race_name, category")
    .in("id", lineupIds)
    .gte("place", 1)
    .lte("place", 3);
  const lineups = (lineupRows as Pick<Lineup, "id" | "event_id" | "place" | "race_name" | "category">[] | null) ?? [];
  const eventIds = [...new Set(lineups.map((l) => l.event_id).filter((id): id is string => !!id))];
  if (eventIds.length === 0) return [];

  const { data: eventRows } = await supabase
    .from("schedule_events")
    .select("id, title, starts_at, artwork_url")
    .in("id", eventIds);
  const eventById = new Map(
    ((eventRows as Pick<ScheduleEvent, "id" | "title" | "starts_at" | "artwork_url">[] | null) ?? []).map((e) => [e.id, e])
  );

  return lineups
    .map((l) => {
      const event = l.event_id ? eventById.get(l.event_id) : undefined;
      if (!event) return null;
      return {
        lineupId: l.id,
        place: l.place as 1 | 2 | 3,
        eventTitle: event.title,
        year: new Date(event.starts_at).getFullYear(),
        startsAt: event.starts_at,
        artworkUrl: event.artwork_url,
        raceLabel: (l.category ? LINEUP_CATEGORIES[l.category] : null) ?? l.race_name,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}
