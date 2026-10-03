import { elapsedLabel, splitRows } from "@/lib/course";
import { clubTimeSecondsLabel } from "@/lib/raceDay";

// A racing boat's splits from course markers (0133): when it passed each
// marker, time from the start, the stretch since the last one and the pace
// per 500 m. GPS from a phone in the boat: for following along, not official.
export function CourseSplits({
  startedAt,
  finishedAt,
  splits,
}: {
  startedAt: string | null;
  finishedAt: string | null;
  splits: { meters: number; passed_at: string }[];
}) {
  const rows = splitRows(startedAt, splits, finishedAt, null);
  if (!startedAt) return null;
  return (
    <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm">
      <p className="font-medium text-green-900">
        {finishedAt ? "Finished" : "Racing"} · started {clubTimeSecondsLabel(startedAt)}
        {finishedAt && <> · {elapsedLabel(new Date(finishedAt).getTime() - new Date(startedAt).getTime())}</>}
      </p>
      {rows.length > 0 ? (
        <table className="mt-1 w-full text-xs tabular-nums">
          <thead className="text-gray-500 text-left">
            <tr>
              <th className="font-normal py-0.5">Passed</th>
              <th className="font-normal">At</th>
              <th className="font-normal text-right">Time</th>
              <th className="font-normal text-right">Split</th>
              <th className="font-normal text-right">/500 m</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-green-100">
                <td className="py-0.5 font-medium">{r.label}</td>
                <td>{clubTimeSecondsLabel(r.at)}</td>
                <td className="text-right">{elapsedLabel(r.elapsedMs)}</td>
                <td className="text-right">{elapsedLabel(r.splitMs)}</td>
                <td className="text-right">{r.pacePer500Ms != null ? elapsedLabel(r.pacePer500Ms) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        !finishedAt && <p className="text-xs text-green-900/80 mt-0.5">Splits show as the boat passes each course marker.</p>
      )}
      <p className="text-[11px] text-gray-500 mt-1">From the phone in the boat. Not official times.</p>
    </div>
  );
}
