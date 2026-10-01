import type { FormQuestion } from "@/lib/database.types";

// Vote counts per office, most votes first; the top max_picks are marked
// elected (ties at the cut-off are flagged rather than decided).
export function ElectionResults({
  offices,
  ballots,
}: {
  offices: FormQuestion[];
  ballots: { question_id: string; choice: string }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {offices.map((o) => {
        const counts = o.options
          .map((name) => ({ name, votes: ballots.filter((b) => b.question_id === o.id && b.choice === name).length }))
          .sort((a, b) => b.votes - a.votes);
        const cutoff = counts[o.max_picks - 1]?.votes ?? 0;
        const tiedAtCutoff = cutoff > 0 && (counts[o.max_picks]?.votes ?? -1) === cutoff;
        return (
          <div key={o.id} className="text-sm">
            <p className="font-medium">
              {o.label}
              {o.max_picks > 1 && <span className="text-xs text-gray-500"> · {o.max_picks} seats</span>}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {counts.map((c) => {
                const elected = c.votes > 0 && (tiedAtCutoff ? c.votes > cutoff : c.votes >= cutoff);
                return (
                  <li key={c.name} className="flex justify-between gap-3">
                    <span className={elected ? "font-semibold" : ""}>
                      {c.name}
                      {elected && " ✓"}
                    </span>
                    <span className="text-gray-500">
                      {c.votes} {c.votes === 1 ? "vote" : "votes"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {tiedAtCutoff && <p className="text-xs text-amber-700">Tie for the last seat.</p>}
          </div>
        );
      })}
    </div>
  );
}
