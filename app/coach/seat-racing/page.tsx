import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewSeatRaceForm } from "./SeatRaceForms";
import { clubDateKey } from "@/lib/raceDay";

export const dynamic = "force-dynamic";

export default async function SeatRacingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (me as { role: string } | null)?.role;
  if (role !== "coach" && role !== "admin") redirect("/coach");

  const { data } = await supabase
    .from("seat_races")
    .select("id, title, raced_on, boat_class, seat_race_pieces(count)")
    .order("raced_on", { ascending: false });
  const races = (data as { id: string; title: string; raced_on: string; boat_class: string; seat_race_pieces: { count: number }[] }[] | null) ?? [];

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-4">
      <div>
        <Link href="/coach" className="text-sm text-gray-500 hover:underline">
          ← Coach
        </Link>
        <h1 className="text-2xl font-bold mt-4">Seat Racing</h1>
        <p className="text-sm text-gray-600 mt-1">
          Race two boats, swap one rower from each, race again. The swing shows who moved the boat.
        </p>
      </div>
      <NewSeatRaceForm today={clubDateKey(new Date())} />
      <div className="flex flex-col gap-2">
        {races.map((r) => (
          <Link key={r.id} href={`/coach/seat-racing/${r.id}`} className="rounded-lg border-2 border-gray-200 px-3 py-2 hover:border-[var(--color-primary)]">
            <span className="font-medium">{r.title}</span>
            <span className="block text-sm text-gray-500">
              {new Date(`${r.raced_on}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} · {r.boat_class} ·{" "}
              {r.seat_race_pieces[0]?.count ?? 0} pieces
            </span>
          </Link>
        ))}
        {races.length === 0 && <p className="text-sm text-gray-500">No seat races yet.</p>}
      </div>
    </div>
  );
}
