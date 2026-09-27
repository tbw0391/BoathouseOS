import Link from "next/link";
import { Sailboat, Dumbbell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/lib/scheduleCalendar";
import { MarkViewed } from "./MarkViewed";
import { ScheduleCalendar } from "./ScheduleCalendar";

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data: eventsData } = await supabase
    .from("schedule_events")
    .select("id, title, event_type, starts_at, ends_at, recurrence, location")
    .order("starts_at", { ascending: true });
  const events = (eventsData as CalendarEvent[] | null) ?? [];

  return (
    <div className="min-h-screen p-8">
      <MarkViewed />
      <h1 className="text-2xl font-bold mb-6">Schedule</h1>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Link
          href="/schedule/regatta"
          className="flex flex-col items-center justify-center gap-2 text-center rounded-lg border-2 border-[var(--color-primary)] px-4 py-8 font-medium hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
        >
          <Sailboat className="w-6 h-6" />
          Regattas
        </Link>
        <Link
          href="/schedule/practice"
          className="flex flex-col items-center justify-center gap-2 text-center rounded-lg border-2 border-[var(--color-primary)] px-4 py-8 font-medium hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
        >
          <Dumbbell className="w-6 h-6" />
          Practice
        </Link>
      </div>

      <div className="mt-8">
        <ScheduleCalendar events={events} />
      </div>
    </div>
  );
}
