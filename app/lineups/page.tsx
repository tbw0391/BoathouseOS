import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type {
  Boat,
  Lineup,
  LineupTemplate,
  LineupTemplateSeat,
  Profile,
  Race,
  ScheduleEvent,
} from "@/lib/database.types";
import { resolveLineupSectionVisibility } from "@/lib/lineupSections";
import { BoatsSection } from "./BoatsSection";
import { LineupTemplatesSection } from "./LineupTemplatesSection";
import { EventIcon } from "@/components/EventIcon";

export default async function LineupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();
  const callerRole = (callerProfile as { role: string } | null)?.role;
  const canManage = callerRole === "admin" || callerRole === "coach";
  const isAdmin = callerRole === "admin";

  const { data: settingsData } = await supabase
    .from("club_settings")
    .select("key, value")
    .eq("key", "lineup_section_visibility");
  const settingsByKey = new Map(
    ((settingsData as { key: string; value: string | null }[] | null) ?? []).map((s) => [s.key, s.value])
  );
  const sectionVisibilityById = resolveLineupSectionVisibility(settingsByKey);
  function sectionVisible(id: string): boolean {
    if (isAdmin) return true;
    const visibility = sectionVisibilityById[id] ?? "everyone";
    if (visibility === "coaches") return canManage;
    return visibility === "everyone";
  }

  const { data: eventsData } = await supabase
    .from("schedule_events")
    .select("*")
    .order("starts_at", { ascending: true });
  const events = (eventsData as ScheduleEvent[] | null) ?? [];

  const { data: lineupsData } = await supabase.from("lineups").select("*");
  const lineups = (lineupsData as Lineup[] | null) ?? [];

  const { data: racesData } = await supabase.from("races").select("*");
  const races = (racesData as Race[] | null) ?? [];

  const { data: boatsData } = await supabase
    .from("boats")
    .select("*")
    .order("name", { ascending: true });
  const boats = (boatsData as Boat[] | null) ?? [];

  const { data: templatesData } = await supabase
    .from("lineup_templates")
    .select("*")
    .order("name", { ascending: true });
  const templates = (templatesData as LineupTemplate[] | null) ?? [];

  const { data: templateSeatsData } = await supabase
    .from("lineup_template_seats")
    .select("*")
    .order("seat_number", { ascending: true });
  const templateSeats = (templateSeatsData as LineupTemplateSeat[] | null) ?? [];

  const { data: rosterData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .is("disabled_at", null)
    .order("display_name", { ascending: true });
  const roster = (rosterData as Pick<Profile, "id" | "display_name">[] | null) ?? [];

  const eventIdsWithLineups = new Set(lineups.map((l) => l.event_id));
  const eventIdsWithRaces = new Set(races.map((r) => r.event_id));
  const now = new Date();
  const relevantEvents = events.filter(
    (e) =>
      new Date(e.starts_at).getTime() >= now.getTime() ||
      eventIdsWithLineups.has(e.id) ||
      eventIdsWithRaces.has(e.id)
  );
  const upcoming = relevantEvents
    .filter((e) => new Date(e.starts_at).getTime() >= now.getTime())
    .sort((a, b) => {
      const aRegatta = a.event_type === "regatta" ? 0 : 1;
      const bRegatta = b.event_type === "regatta" ? 0 : 1;
      if (aRegatta !== bRegatta) return aRegatta - bRegatta;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });
  const past = relevantEvents
    .filter((e) => new Date(e.starts_at).getTime() < now.getTime())
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  function EventButton({ event }: { event: ScheduleEvent }) {
    const pendingCount = races.filter((r) => r.event_id === event.id && !r.lineup_id).length;
    return (
      <Link
        href={`/lineups/${event.id}`}
        className="flex items-center justify-between gap-2 rounded-lg border-2 border-[var(--color-primary)] px-6 py-5 hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2 text-lg font-medium">
          <EventIcon title={event.title} iconUrl={event.icon_url} className="w-7 h-7" />
          {event.title}
        </span>
        <span className="text-base text-gray-500 text-right">
          {new Date(event.starts_at).toLocaleDateString()}
          {pendingCount > 0 && (
            <>
              <br />
              {pendingCount} need{pendingCount === 1 ? "s" : ""} a lineup
            </>
          )}
        </span>
      </Link>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Lineups</h1>

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-sm text-gray-500">No events on the schedule yet.</p>
      )}

      <div className="flex flex-col gap-3 w-full">
        {upcoming.map((event) => (
          <EventButton key={event.id} event={event} />
        ))}
      </div>

      {canManage && (sectionVisible("fleet") || sectionVisible("templates")) && (
        <div className="mt-8 flex flex-col gap-3">
          {sectionVisible("fleet") && <BoatsSection boats={boats} />}
          {sectionVisible("templates") && (
            <LineupTemplatesSection
              templates={templates}
              templateSeats={templateSeats}
              roster={roster}
              boats={boats}
            />
          )}
        </div>
      )}

      {past.length > 0 && (
        <details className="mt-8 w-full">
          <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-black">
            Past ({past.length})
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {past.map((event) => (
              <EventButton key={event.id} event={event} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
