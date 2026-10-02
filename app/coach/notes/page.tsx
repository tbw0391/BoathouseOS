import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CoachNote } from "@/lib/database.types";
import { clubDateKey } from "@/lib/raceDay";
import { NotesThread } from "./NotesThread";

export const dynamic = "force-dynamic";

const isDateKey = (s: string | undefined): s is string => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));

function shiftDay(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const dayLabel = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

// Coach Notes (0122): a practice day's shared notes, and notes about each
// athlete. Only coaches and admins ever see them.
export default async function CoachNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; date?: string; athlete?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (me as { role: string } | null)?.role;
  if (role !== "coach" && role !== "admin") redirect("/coach");

  const params = await searchParams;
  const tab = params.tab === "athletes" ? "athletes" : "practice";
  const today = clubDateKey(new Date());
  const date = isDateKey(params.date) ? params.date : today;

  const [{ data: staffData }, { data: athletesData }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").in("role", ["coach", "admin"]),
    supabase
      .from("profiles")
      .select("id, display_name, role")
      .in("role", ["rower", "coxswain"])
      .is("disabled_at", null)
      .not("approved_at", "is", null)
      .order("display_name"),
  ]);
  const authorNames = Object.fromEntries(
    ((staffData as { id: string; display_name: string }[] | null) ?? []).map((p) => [p.id, p.display_name])
  );
  const athletes = (athletesData as { id: string; display_name: string; role: string }[] | null) ?? [];
  const athlete = tab === "athletes" ? athletes.find((a) => a.id === params.athlete) ?? null : null;

  let notes: CoachNote[] = [];
  const noteCounts = new Map<string, number>();
  if (tab === "practice") {
    const { data } = await supabase
      .from("coach_notes")
      .select("*")
      .eq("note_date", date)
      .is("athlete_id", null)
      .order("created_at");
    notes = (data as CoachNote[] | null) ?? [];
  } else if (athlete) {
    const { data } = await supabase.from("coach_notes").select("*").eq("athlete_id", athlete.id).order("created_at");
    notes = (data as CoachNote[] | null) ?? [];
  } else {
    const { data } = await supabase.from("coach_notes").select("athlete_id").not("athlete_id", "is", null);
    for (const n of (data as { athlete_id: string }[] | null) ?? []) {
      noteCounts.set(n.athlete_id, (noteCounts.get(n.athlete_id) ?? 0) + 1);
    }
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg border-2 px-3 py-2 text-center text-sm font-medium ${
      active
        ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
        : "border-gray-300 hover:border-[var(--color-primary)]"
    }`;

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-4">
      <div>
        <Link href="/coach" className="text-sm text-gray-500 hover:underline">
          ← Coach
        </Link>
        <h1 className="text-2xl font-bold mt-4">Coach Notes</h1>
        <p className="text-sm text-gray-600 mt-1">Only coaches and admins can see these.</p>
      </div>

      <div className="flex gap-2">
        <Link href="/coach/notes" className={tabClass(tab === "practice")}>
          Practice
        </Link>
        <Link href="/coach/notes?tab=athletes" className={tabClass(tab === "athletes")}>
          Athletes
        </Link>
      </div>

      {tab === "practice" && (
        <>
          <div className="flex items-center justify-between">
            <Link href={`/coach/notes?date=${shiftDay(date, -1)}`} className="text-sm underline text-gray-600">
              ‹ Day before
            </Link>
            <p className="font-semibold">{date === today ? `Today, ${dayLabel(date)}` : dayLabel(date)}</p>
            {date < today ? (
              <Link href={`/coach/notes?date=${shiftDay(date, 1)}`} className="text-sm underline text-gray-600">
                Next day ›
              </Link>
            ) : (
              <span className="w-16" />
            )}
          </div>
          <NotesThread
            key={date}
            initialNotes={notes}
            athleteId={null}
            noteDate={date}
            authorNames={authorNames}
            currentUserId={user.id}
            isAdmin={role === "admin"}
            placeholder="A note for the other coaches about today's practice"
          />
        </>
      )}

      {tab === "athletes" && athlete && (
        <>
          <Link href="/coach/notes?tab=athletes" className="text-sm text-gray-500 hover:underline">
            ← All athletes
          </Link>
          <h2 className="text-lg font-semibold">
            {athlete.display_name}
            {athlete.role === "coxswain" && <span className="text-sm font-normal text-gray-500"> · coxswain</span>}
          </h2>
          <NotesThread
            key={athlete.id}
            initialNotes={notes}
            athleteId={athlete.id}
            noteDate={null}
            authorNames={authorNames}
            currentUserId={user.id}
            isAdmin={role === "admin"}
            placeholder={`A note about ${athlete.display_name}`}
          />
        </>
      )}

      {tab === "athletes" && !athlete && (
        <ul className="flex flex-col gap-2">
          {athletes.map((a) => {
            const count = noteCounts.get(a.id) ?? 0;
            return (
              <li key={a.id}>
                <Link
                  href={`/coach/notes?tab=athletes&athlete=${a.id}`}
                  className="flex items-center justify-between rounded-lg border-2 border-gray-200 px-3 py-2 hover:border-[var(--color-primary)]"
                >
                  <span className="font-medium">
                    {a.display_name}
                    {a.role === "coxswain" && <span className="text-sm font-normal text-gray-500"> · cox</span>}
                  </span>
                  <span className="text-sm text-gray-500">
                    {count === 0 ? "No notes" : `${count} ${count === 1 ? "note" : "notes"}`}
                  </span>
                </Link>
              </li>
            );
          })}
          {athletes.length === 0 && <p className="text-sm text-gray-500">No rowers or coxswains on the roster yet.</p>}
        </ul>
      )}
    </div>
  );
}
