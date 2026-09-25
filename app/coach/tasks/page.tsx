import { createClient } from "@/lib/supabase/server";
import type {
  CoachTask,
  CoachTaskAssignment,
  Lineup,
  Profile,
  Race,
  ScheduleEvent,
  TaskType,
} from "@/lib/database.types";
import { EventIcon } from "@/components/EventIcon";
import { TaskTypeManager } from "./TaskTypeManager";
import { TaskForm } from "./TaskForm";
import { TaskRow } from "./TaskRow";

export default async function CoachTasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();
  const callerRole = (callerProfile as Pick<Profile, "role"> | null)?.role;
  const canManage = callerRole === "admin" || callerRole === "coach";

  const { data: eventsData } = await supabase
    .from("schedule_events")
    .select("*")
    .order("starts_at", { ascending: true });
  const events = (eventsData as ScheduleEvent[] | null) ?? [];

  const { data: taskTypesData } = await supabase
    .from("task_types")
    .select("*")
    .order("name", { ascending: true });
  const taskTypes = (taskTypesData as TaskType[] | null) ?? [];

  const { data: tasksData } = await supabase
    .from("coach_tasks")
    .select("*")
    .order("created_at", { ascending: true });
  const tasks = (tasksData as CoachTask[] | null) ?? [];

  const { data: assignmentsData } = await supabase.from("coach_task_assignments").select("*");
  const assignments = (assignmentsData as CoachTaskAssignment[] | null) ?? [];

  const lineupIds = [...new Set(tasks.map((t) => t.lineup_id).filter((id): id is string => !!id))];
  const { data: lineupsData } = lineupIds.length
    ? await supabase.from("lineups").select("id, boat_name").in("id", lineupIds)
    : { data: [] as Pick<Lineup, "id" | "boat_name">[] };
  const boatNameByLineupId = new Map(
    ((lineupsData as Pick<Lineup, "id" | "boat_name">[] | null) ?? []).map((l) => [l.id, l.boat_name])
  );

  // Tasks auto-created straight off a race import (see importRaces) don't
  // have a boat yet — fall back to the race's own name so the task still
  // reads as something other than a bare "Launch."
  const raceIds = [...new Set(tasks.map((t) => t.race_id).filter((id): id is string => !!id))];
  const { data: racesData } = raceIds.length
    ? await supabase.from("races").select("id, race_name").in("id", raceIds)
    : { data: [] as Pick<Race, "id" | "race_name">[] };
  const raceNameByRaceId = new Map(
    ((racesData as Pick<Race, "id" | "race_name">[] | null) ?? []).map((r) => [r.id, r.race_name])
  );

  function subtitleForTask(task: CoachTask): string | null {
    if (task.lineup_id) return boatNameByLineupId.get(task.lineup_id) ?? null;
    if (task.race_id) return raceNameByRaceId.get(task.race_id) ?? null;
    return null;
  }

  const { data: rosterData } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .is("disabled_at", null)
    .order("display_name", { ascending: true });
  const roster = (rosterData as Pick<Profile, "id" | "display_name" | "role">[] | null) ?? [];
  const nameById = new Map(roster.map((p) => [p.id, p.display_name]));

  const taskIdsWithTasks = new Set(tasks.map((t) => t.event_id));
  const now = new Date();
  const relevantEvents = events.filter(
    (e) => new Date(e.starts_at).getTime() >= now.getTime() || taskIdsWithTasks.has(e.id)
  );
  const upcoming = relevantEvents.filter((e) => new Date(e.starts_at).getTime() >= now.getTime());
  const past = relevantEvents
    .filter((e) => new Date(e.starts_at).getTime() < now.getTime())
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  function EventSection({ event }: { event: ScheduleEvent }) {
    const eventTasks = tasks.filter((t) => t.event_id === event.id);

    return (
      <div>
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          <EventIcon title={event.title} iconUrl={event.icon_url} className="w-6 h-6" />
          {event.title}{" "}
          <span className="text-sm font-normal text-gray-500">
            {new Date(event.starts_at).toLocaleDateString()}
          </span>
        </h2>

        <div className="mt-3 flex flex-col gap-3 max-w-lg">
          {eventTasks.length === 0 && (
            <p className="text-sm text-gray-500">
              No tasks posted yet{canManage ? " — add one below." : "."}
            </p>
          )}

          {eventTasks.map((task) => {
            const taskAssignments = assignments.filter((a) => a.task_id === task.id);
            return (
              <TaskRow
                key={task.id}
                task={task}
                taskTypes={taskTypes}
                subtitle={subtitleForTask(task)}
                assignedIds={taskAssignments.map((a) => a.user_id)}
                assignedNames={taskAssignments.map((a) => nameById.get(a.user_id) ?? "Unknown")}
                roster={roster}
                canManage={canManage}
              />
            );
          })}

          {canManage && <TaskForm eventId={event.id} taskTypes={taskTypes} />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Coach Tasks</h1>

      {canManage && <TaskTypeManager taskTypes={taskTypes} />}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-sm text-gray-500">No events on the schedule yet.</p>
      )}

      <div className="flex flex-col gap-8">
        {upcoming.map((event) => (
          <EventSection key={event.id} event={event} />
        ))}
      </div>

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-black">
            Past ({past.length})
          </summary>
          <div className="mt-3 flex flex-col gap-8">
            {past.map((event) => (
              <EventSection key={event.id} event={event} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
