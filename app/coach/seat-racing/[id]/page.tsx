import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { netByRower, swapResults, type SeatPiece } from "@/lib/seatRacing";
import { PieceEditor, SeatRaceBuilder, DeleteSeatRace } from "../SeatRaceForms";

export const dynamic = "force-dynamic";

export default async function SeatRacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (me as { role: string } | null)?.role;
  if (role !== "coach" && role !== "admin") redirect("/coach");

  const [{ data: raceRow }, { data: pieceRows }, { data: people }] = await Promise.all([
    supabase.from("seat_races").select("*").eq("id", id).maybeSingle(),
    supabase.from("seat_race_pieces").select("*").eq("seat_race_id", id).order("piece_no"),
    supabase
      .from("profiles")
      .select("id, display_name")
      .in("role", ["rower", "coxswain"])
      .is("disabled_at", null)
      .not("approved_at", "is", null)
      .order("display_name"),
  ]);
  if (!raceRow) notFound();
  const race = raceRow as { id: string; title: string; raced_on: string; boat_class: string; distance_m: number | null };
  const pieces = ((pieceRows as (SeatPiece & { id: string })[] | null) ?? []).map((p) => ({
    ...p,
    time_a: p.time_a != null ? Number(p.time_a) : null,
    time_b: p.time_b != null ? Number(p.time_b) : null,
  }));
  const roster = ((people as { id: string; display_name: string }[] | null) ?? []).map((p) => ({ id: p.id, name: p.display_name }));
  const nameOf = (rid: string) => roster.find((p) => p.id === rid)?.name ?? "Someone";
  const seats = BOAT_CLASSES[race.boat_class]?.rowerSeats ?? 2;

  const results = swapResults(pieces);
  const net = [...netByRower(results).entries()].sort((a, b) => b[1].net - a[1].net);
  const last = pieces.at(-1) ?? null;

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-5">
      <div>
        <Link href="/coach/seat-racing" className="text-sm text-gray-500 hover:underline">
          ← Seat Racing
        </Link>
        <h1 className="text-2xl font-bold mt-4">{race.title}</h1>
        <p className="text-sm text-gray-600">
          {new Date(`${race.raced_on}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} ·{" "}
          {race.boat_class}
          {race.distance_m && ` · ${race.distance_m}m`}
        </p>
      </div>

      {net.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Standings</h2>
          <table className="text-sm">
            <tbody>
              {net.map(([rid, v]) => (
                <tr key={rid} className="border-b border-gray-100">
                  <td className="py-1 pr-3">{nameOf(rid)}</td>
                  <td className={`py-1 pr-3 text-right tabular-nums font-medium ${v.net > 0 ? "text-green-700" : v.net < 0 ? "text-red-700" : ""}`}>
                    {v.net > 0 ? "+" : ""}
                    {v.net.toFixed(1)} s
                  </td>
                  <td className="py-1 text-gray-500">
                    {v.swaps} swap{v.swaps === 1 ? "" : "s"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="text-sm text-gray-700 flex flex-col gap-1">
            {results.map((r) => (
              <li key={`${r.fromPiece}-${r.toPiece}`}>
                Pieces {r.fromPiece}→{r.toPiece}:{" "}
                {r.swing === 0
                  ? `${nameOf(r.x)} and ${nameOf(r.y)} were even`
                  : r.swing > 0
                    ? `${nameOf(r.x)} beat ${nameOf(r.y)} by ${r.swing.toFixed(1)} s`
                    : `${nameOf(r.y)} beat ${nameOf(r.x)} by ${(-r.swing).toFixed(1)} s`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Pieces</h2>
        {pieces.length === 0 && <p className="text-sm text-gray-500">Set up the two boats for the first piece below.</p>}
        {pieces.map((p) => (
          <PieceEditor
            key={p.id}
            raceId={race.id}
            piece={p}
            boatA={p.boat_a.map((r) => ({ id: r, name: nameOf(r) }))}
            boatB={p.boat_b.map((r) => ({ id: r, name: nameOf(r) }))}
          />
        ))}
      </section>

      <SeatRaceBuilder
        raceId={race.id}
        seats={seats}
        roster={roster}
        last={last ? { boat_a: last.boat_a, boat_b: last.boat_b } : null}
      />

      <DeleteSeatRace raceId={race.id} />
    </div>
  );
}
