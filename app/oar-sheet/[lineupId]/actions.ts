"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";
import { OAR_COLORS_KEY, oarSeats, parseOarSettings } from "@/lib/oarSheet";
import { UserError, tryAction } from "@/lib/userError";

// Who can change a sheet is enforced by the database (the boat's cox or
// stroke, coaches and admins — 0095); these check the input and turn a
// refusal into a readable message.

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");
  return { supabase, user };
}

async function checkOar(supabase: Awaited<ReturnType<typeof createClient>>, color: string, rings: number) {
  const { data } = await supabase.from("club_settings").select("value").eq("key", OAR_COLORS_KEY).maybeSingle();
  const settings = parseOarSettings((data as { value: string | null } | null)?.value);
  if (!settings.colors.includes(color)) throw new UserError("Pick one of the club's tape colors.");
  if (!Number.isInteger(rings) || rings < 1 || rings > settings.maxRings) {
    throw new UserError(`Rings must be 1 to ${settings.maxRings}.`);
  }
}

async function rowingSeatNumbers(supabase: Awaited<ReturnType<typeof createClient>>, lineupId: string) {
  const { data } = await supabase
    .from("lineup_seats")
    .select("seat_number, seat_role, rower_id")
    .eq("lineup_id", lineupId);
  return oarSeats((data as { seat_number: number; seat_role: string; rower_id: string | null }[] | null) ?? []).map(
    (s) => s.seat_number
  );
}

function refused(error: { message: string; code?: string }): Error {
  return new UserError(
    error.code === "42501" || /row-level security/i.test(error.message)
      ? "Only this boat's cox (or stroke), coaches and admins can change its oar sheet."
      : error.message
  );
}

export async function setSeatOar(lineupId: string, seatNumber: number, oar: { color: string; rings: number } | null) {
  return tryAction(async () => {
    const { supabase, user } = await signedIn();
    if (!(await rowingSeatNumbers(supabase, lineupId)).includes(seatNumber)) throw new UserError("That seat isn't in this boat.");

    if (oar) {
      await checkOar(supabase, oar.color, oar.rings);
      const { error } = await supabase.from("lineup_oars").upsert(
        {
          lineup_id: lineupId,
          seat_number: seatNumber,
          tape_color: oar.color,
          rings: oar.rings,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lineup_id,seat_number" }
      );
      if (error) throw refused(error);
    } else {
      const { error } = await supabase.from("lineup_oars").delete().eq("lineup_id", lineupId).eq("seat_number", seatNumber);
      if (error) throw refused(error);
    }

    revalidatePath(`/oar-sheet/${lineupId}`);
    revalidatePath("/");
  });
}

// One color for the whole boat, rings matching the seat (bow = 1 ring).
export async function fillBoatWithColor(lineupId: string, color: string) {
  return tryAction(async () => {
    const { supabase, user } = await signedIn();
    const seats = await rowingSeatNumbers(supabase, lineupId);
    if (seats.length === 0) return;
    await checkOar(supabase, color, Math.max(...seats));

    const now = new Date().toISOString();
    const { error } = await supabase.from("lineup_oars").upsert(
      seats.map((n) => ({
        lineup_id: lineupId,
        seat_number: n,
        tape_color: color,
        rings: n,
        updated_by: user.id,
        updated_at: now,
      })),
      { onConflict: "lineup_id,seat_number" }
    );
    if (error) throw refused(error);

    revalidatePath(`/oar-sheet/${lineupId}`);
    revalidatePath("/");
  });
}

// Add or remove someone on this boat's Launch or Recovery task.
export async function setTaskPerson(lineupId: string, taskId: string, personId: string, on: boolean) {
  return tryAction(async () => {
    const { supabase, user } = await signedIn();

    const { data: task } = await supabase
      .from("coach_tasks")
      .select("id, lineup_id, task_types(name)")
      .eq("id", taskId)
      .maybeSingle();
    const t = task as { id: string; lineup_id: string | null; task_types: { name: string } | null } | null;
    if (!t || t.lineup_id !== lineupId) throw new UserError("That task isn't for this boat.");

    if (on) {
      const { error } = await supabase
        .from("coach_task_assignments")
        .upsert({ task_id: taskId, user_id: personId }, { onConflict: "task_id,user_id", ignoreDuplicates: true });
      if (error) throw refused(error);

      if (personId !== user.id) {
        const { data: lineup } = await supabase
          .from("lineups")
          .select("boat_name, race_name, schedule_events(title)")
          .eq("id", lineupId)
          .maybeSingle();
        const l = lineup as { boat_name: string; race_name: string | null; schedule_events: { title: string } | null } | null;
        const job = t.task_types?.name ?? "Launch/Recovery";
        await sendPush([personId], {
          kind: "launch_recovery",
          title: `You're on ${job}: ${l?.boat_name ?? "a boat"}`,
          body: `${l?.race_name ?? l?.boat_name ?? "A race"}${l?.schedule_events ? ` at ${l.schedule_events.title}` : ""}.`,
          url: "/",
          tag: `task-${taskId}-${personId}`,
        });
      }
    } else {
      const { error } = await supabase.from("coach_task_assignments").delete().eq("task_id", taskId).eq("user_id", personId);
      if (error) throw refused(error);
    }

    revalidatePath(`/oar-sheet/${lineupId}`);
    revalidatePath("/coach/tasks");
    revalidatePath("/");
  });
}
