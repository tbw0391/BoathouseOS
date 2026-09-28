import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { seatLabel, clubTimeLabel } from "@/lib/raceDay";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { OAR_COLORS_KEY, captainSeat, oarLabel, oarSeats, parseOarSettings } from "@/lib/oarSheet";
import { OarSheetForm, type OarSeatRow, type TaskRow } from "./OarSheetForm";

type Seat = { id: string; seat_number: number; seat_role: string; rower_id: string | null };
type OarRow = { lineup_id: string; seat_number: number; tape_color: string; rings: number };

export default async function OarSheetPage({ params }: { params: Promise<{ lineupId: string }> }) {
  const { lineupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lineupData } = await supabase
    .from("lineups")
    .select("id, boat_name, boat_class, race_name, race_time, event_id")
    .eq("id", lineupId)
    .maybeSingle();
  const lineup = lineupData as {
    id: string;
    boat_name: string;
    boat_class: string;
    race_name: string | null;
    race_time: string | null;
    event_id: string | null;
  } | null;
  if (!lineup) notFound();

  const [{ data: me }, { data: eventData }, { data: seatRows }, { data: setting }, { data: taskRows }, { data: people }] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      lineup.event_id
        ? supabase.from("schedule_events").select("id, title, starts_at").eq("id", lineup.event_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("lineup_seats").select("id, seat_number, seat_role, rower_id").eq("lineup_id", lineupId),
      supabase.from("club_settings").select("value").eq("key", OAR_COLORS_KEY).maybeSingle(),
      supabase.from("coach_tasks").select("id, task_types(name)").eq("lineup_id", lineupId),
      supabase
        .from("profiles")
        .select("id, display_name, role")
        .is("disabled_at", null)
        .not("approved_at", "is", null)
        .order("display_name"),
    ]);
  const role = (me as { role: string } | null)?.role;
  const event = eventData as { id: string; title: string; starts_at: string } | null;
  const seats = (seatRows as Seat[] | null) ?? [];
  const settings = parseOarSettings((setting as { value: string | null } | null)?.value);
  const roster = ((people as { id: string; display_name: string; role: string }[] | null) ?? []).map((p) => ({
    id: p.id,
    name: p.display_name,
    role: p.role,
  }));
  const nameById = new Map(roster.map((p) => [p.id, p.name]));

  const captain = captainSeat(seats);
  const canEdit = captain?.rower_id === user.id || role === "coach" || role === "admin";

  // Oars on every boat at this regatta, to flag one picked twice.
  const { data: eventLineups } = lineup.event_id
    ? await supabase.from("lineups").select("id, boat_name, race_time").eq("event_id", lineup.event_id)
    : { data: [] };
  const otherBoats = new Map(
    ((eventLineups as { id: string; boat_name: string; race_time: string | null }[] | null) ?? [])
      .filter((l) => l.id !== lineupId)
      .map((l) => [l.id, l])
  );
  const { data: oarRows } = await supabase
    .from("lineup_oars")
    .select("lineup_id, seat_number, tape_color, rings")
    .in("lineup_id", [lineupId, ...otherBoats.keys()]);
  const allOars = (oarRows as OarRow[] | null) ?? [];
  const mine = allOars.filter((o) => o.lineup_id === lineupId);

  const rowerSeats = BOAT_CLASSES[lineup.boat_class]?.rowerSeats ?? oarSeats(seats).length;
  const seatRowsOut: OarSeatRow[] = oarSeats(seats).map((s) => {
    const oar = mine.find((o) => o.seat_number === s.seat_number) ?? null;
    const alsoIn = oar
      ? allOars
          .filter((o) => o.lineup_id !== lineupId && o.tape_color === oar.tape_color && o.rings === oar.rings)
          .map((o) => {
            const b = otherBoats.get(o.lineup_id);
            return b ? `${b.boat_name}${b.race_time ? ` (${clubTimeLabel(b.race_time)})` : ""}` : "another boat";
          })
      : [];
    return {
      seatNumber: s.seat_number,
      label: seatLabel(s, rowerSeats),
      rowerName: s.rower_id ? (nameById.get(s.rower_id) ?? "—") : "Empty",
      oar: oar ? { color: oar.tape_color, rings: oar.rings } : null,
      alsoIn,
    };
  });

  const tasks = ((taskRows as { id: string; task_types: { name: string } | null }[] | null) ?? []).sort((a, b) =>
    (a.task_types?.name ?? "").localeCompare(b.task_types?.name ?? "")
  );
  const { data: assignmentRows } = tasks.length
    ? await supabase.from("coach_task_assignments").select("task_id, user_id").in("task_id", tasks.map((t) => t.id))
    : { data: [] };
  const assignments = (assignmentRows as { task_id: string; user_id: string }[] | null) ?? [];
  const taskRowsOut: TaskRow[] = tasks.map((t) => ({
    id: t.id,
    name: t.task_types?.name ?? "Task",
    people: assignments
      .filter((a) => a.task_id === t.id)
      .map((a) => ({ id: a.user_id, name: nameById.get(a.user_id) ?? "Unknown" })),
  }));

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <Link href={event ? `/lineups/${event.id}` : "/lineups"} className="text-sm text-gray-500 hover:underline">
        ← Lineups
      </Link>
      <h1 className="text-2xl font-bold mt-4">Oar sheet: {lineup.boat_name}</h1>
      <p className="text-sm text-gray-600 mt-1">
        {[lineup.race_name, lineup.race_time ? clubTimeLabel(lineup.race_time) : null, event?.title]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        {captain?.rower_id
          ? `Filled in by ${nameById.get(captain.rower_id) ?? "the cox"} (${captain.seat_role === "coxswain" ? "cox" : "stroke"}).`
          : "No cox or stroke in this boat yet, so a coach fills this in."}
      </p>

      {canEdit ? (
        <OarSheetForm
          lineupId={lineupId}
          colors={settings.colors}
          maxRings={settings.maxRings}
          seats={seatRowsOut}
          tasks={taskRowsOut}
          roster={roster}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col gap-1 text-sm">
            {seatRowsOut.map((s) => (
              <li key={s.seatNumber} className="flex justify-between border-b py-1.5">
                <span>
                  <span className="font-medium">{s.label}</span> · {s.rowerName}
                </span>
                <span>{s.oar ? oarLabel({ rings: s.oar.rings, tape_color: s.oar.color }) : "—"}</span>
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-1 text-sm">
            {taskRowsOut.map((t) => (
              <li key={t.id}>
                <span className="font-medium">{t.name}:</span>{" "}
                {t.people.length ? t.people.map((p) => p.name).join(", ") : "—"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
