import { createClient } from "@/lib/supabase/server";
import { getSelectedClubSlug, visibleToClub } from "@/lib/demoClubs";
import type { CoachTask, CoachTaskAssignment, Lineup, Profile, Race, TaskType } from "@/lib/database.types";
import { TaskForm } from "./TaskForm";
import { TaskRow } from "./TaskRow";

// One regatta's jobs (Launch, Recovery, and anything else posted), with who
// is on each — the Jobs tab on a regatta's page. Same rows and add form as
// the Coach Tasks page, just scoped to this event.
export async function EventTasks({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const supabase = await createClient();

  const [{ data: taskTypesData }, { data: tasksData }, { data: rosterData }] = await Promise.all([
    supabase.from("task_types").select("*").order("name", { ascending: true }),
    supabase.from("coach_tasks").select("*").eq("event_id", eventId).order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, display_name, role")
      .is("disabled_at", null)
      .order("display_name", { ascending: true }),
  ]);
  const taskTypes = (taskTypesData as TaskType[] | null) ?? [];
  const allTasks = (tasksData as CoachTask[] | null) ?? [];
  const roster = (rosterData as Pick<Profile, "id" | "display_name" | "role">[] | null) ?? [];
  const nameById = new Map(roster.map((p) => [p.id, p.display_name]));

  const lineupIds = [...new Set(allTasks.map((t) => t.lineup_id).filter((id): id is string => !!id))];
  const raceIds = [...new Set(allTasks.map((t) => t.race_id).filter((id): id is string => !!id))];
  const [{ data: assignmentsData }, { data: lineupsData }, { data: racesData }] = await Promise.all([
    allTasks.length
      ? supabase.from("coach_task_assignments").select("*").in("task_id", allTasks.map((t) => t.id))
      : Promise.resolve({ data: [] as CoachTaskAssignment[] }),
    lineupIds.length
      ? supabase.from("lineups").select("id, boat_name, club_slug").in("id", lineupIds)
      : Promise.resolve({ data: [] as Pick<Lineup, "id" | "boat_name" | "club_slug">[] }),
    raceIds.length
      ? supabase.from("races").select("id, race_name, club_slug").in("id", raceIds)
      : Promise.resolve({ data: [] as Pick<Race, "id" | "race_name" | "club_slug">[] }),
  ]);

  // With a club picked, drop jobs for another club's races or boats.
  const selectedClubSlug = await getSelectedClubSlug();
  const clubByLineupId = new Map(
    ((lineupsData as Pick<Lineup, "id" | "club_slug">[] | null) ?? []).map((l) => [l.id, l.club_slug])
  );
  const clubByRaceId = new Map(
    ((racesData as Pick<Race, "id" | "club_slug">[] | null) ?? []).map((r) => [r.id, r.club_slug])
  );
  const tasks = allTasks.filter((t) =>
    visibleToClub(
      (t.lineup_id ? clubByLineupId.get(t.lineup_id) : null) ?? (t.race_id ? clubByRaceId.get(t.race_id) : null),
      selectedClubSlug
    )
  );
  const assignments = (assignmentsData as CoachTaskAssignment[] | null) ?? [];
  const boatNameByLineupId = new Map(
    ((lineupsData as Pick<Lineup, "id" | "boat_name">[] | null) ?? []).map((l) => [l.id, l.boat_name])
  );
  const raceNameByRaceId = new Map(
    ((racesData as Pick<Race, "id" | "race_name">[] | null) ?? []).map((r) => [r.id, r.race_name])
  );

  function subtitleForTask(task: CoachTask): string | null {
    if (task.lineup_id) return boatNameByLineupId.get(task.lineup_id) ?? null;
    if (task.race_id) return raceNameByRaceId.get(task.race_id) ?? null;
    return null;
  }

  return (
    <div className="flex flex-col gap-3 max-w-lg">
      {tasks.length === 0 && (
        <p className="text-sm text-gray-500">No jobs posted yet{canManage ? " — add one below." : "."}</p>
      )}
      {tasks.map((task) => {
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
      {canManage && <TaskForm eventId={eventId} taskTypes={taskTypes} />}
    </div>
  );
}
