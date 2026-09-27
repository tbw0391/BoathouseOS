import { createClient } from "@/lib/supabase/server";
import type { PracticeAttendance, Profile } from "@/lib/database.types";
import { formatAttendanceTime, isPracticeDay, todaysPracticeDate } from "@/lib/practiceAttendance";

type Member = Pick<Profile, "id" | "display_name" | "role">;

export default async function CoachAttendancePage() {
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
  const canView = callerRole === "coach" || callerRole === "admin";

  if (!canView) {
    return (
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-6">Practice Attendance</h1>
        <p className="text-sm text-gray-500">Only coaches and admins can view attendance.</p>
      </div>
    );
  }

  const [{ data: memberData }, { data: attendanceData }, practiceDay] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, role")
      .in("role", ["rower", "coxswain"])
      .is("disabled_at", null)
      .not("approved_at", "is", null)
      .order("display_name", { ascending: true }),
    supabase.from("practice_attendance").select("*").eq("practice_date", todaysPracticeDate()),
    isPracticeDay(),
  ]);
  const members = (memberData as Member[] | null) ?? [];
  const byProfile = new Map(
    ((attendanceData as PracticeAttendance[] | null) ?? []).map((a) => [a.profile_id, a])
  );

  const checkedIn = members.filter((m) => byProfile.get(m.id)?.status === "checked_in");
  const absent = members.filter((m) => byProfile.get(m.id)?.status === "absent");
  const noAnswer = members.filter((m) => !byProfile.has(m.id));

  const today = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-1">Practice Attendance</h1>
      <p className="text-sm text-gray-500 mb-6">{today}</p>
      {!practiceDay && (
        <p className="mb-6 rounded-lg border-2 border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          No practice check-in today (Sundays and regatta days are off).
        </p>
      )}

      <section className="mb-6">
        <h2 className="font-semibold text-green-800 mb-2">Checked in ({checkedIn.length})</h2>
        <ul className="flex flex-col gap-1">
          {checkedIn.map((m) => (
            <li key={m.id} className="flex justify-between text-sm">
              <span>{m.display_name}</span>
              <span className="text-gray-500">{formatAttendanceTime(byProfile.get(m.id)!.responded_at)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold text-red-800 mb-2">Not coming ({absent.length})</h2>
        <ul className="flex flex-col gap-1">
          {absent.map((m) => (
            <li key={m.id} className="flex justify-between text-sm">
              <span>{m.display_name}</span>
              <span className="text-gray-500">{byProfile.get(m.id)!.reason}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-gray-700 mb-2">No answer yet ({noAnswer.length})</h2>
        <ul className="flex flex-col gap-1">
          {noAnswer.map((m) => (
            <li key={m.id} className="text-sm text-gray-600">
              {m.display_name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
