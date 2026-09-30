import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { consoleUser } from "@/lib/console";
import { NotGlobalAdmin } from "../ui";
import { clearFixedErrors, markErrorFixed } from "../actions";
import { ActionForm } from "@/components/ActionForm";

type ErrorReport = {
  id: string;
  message: string;
  route: string | null;
  route_type: string | null;
  last_path: string | null;
  last_digest: string | null;
  stack: string | null;
  count: number;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
};

// Unexpected server errors caught by instrumentation.ts (0100), newest first.
export default async function ErrorReportsPage() {
  if (!(await consoleUser())) return <NotGlobalAdmin />;

  const { data } = await createAdminClient()
    .from("error_reports")
    .select("id, message, route, route_type, last_path, last_digest, stack, count, first_seen, last_seen, resolved_at")
    .order("last_seen", { ascending: false })
    .limit(200);
  const reports = (data as ErrorReport[] | null) ?? [];
  const open = reports.filter((r) => !r.resolved_at);
  const fixed = reports.filter((r) => r.resolved_at);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div>
        <Link href="/console/health" className="text-sm text-gray-500 hover:underline">
          ← Site health
        </Link>
        <h1 className="text-2xl font-bold mt-1">Errors</h1>
        <p className="text-sm text-gray-500">
          Unexpected errors on the live site: the ones members see as &quot;An error occurred&quot;. You get
          an email when a new one shows up (at most one per error per hour). Mark one fixed once the
          fix is deployed; if it happens again it comes back here and emails you.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Open ({open.length})</h2>
        {open.length === 0 && <p className="text-sm text-gray-500">None. 🎉</p>}
        {open.map((r) => (
          <ErrorCard key={r.id} report={r} />
        ))}
      </section>

      {fixed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Marked fixed ({fixed.length})</h2>
            <form action={clearFixedErrors}>
              <button type="submit" className="text-sm border-2 border-gray-300 rounded px-3 py-1">
                Clear fixed
              </button>
            </form>
          </div>
          {fixed.map((r) => (
            <ErrorCard key={r.id} report={r} />
          ))}
        </section>
      )}
    </div>
  );
}

function ErrorCard({ report: r }: { report: ErrorReport }) {
  return (
    <div className={`bg-white border-2 rounded-lg p-4 flex flex-col gap-2 ${r.resolved_at ? "border-gray-200 opacity-70" : "border-red-300"}`}>
      <p className="font-medium break-words">{r.message}</p>
      <p className="text-sm text-gray-600 break-words">
        {r.route ?? r.last_path}
        {r.route_type && <span className="text-gray-400"> · {r.route_type}</span>}
      </p>
      <p className="text-xs text-gray-500">
        {r.count} {r.count === 1 ? "time" : "times"} · first {new Date(r.first_seen).toLocaleString()} · last{" "}
        {new Date(r.last_seen).toLocaleString()}
        {r.last_digest && <> · digest {r.last_digest}</>}
      </p>
      {r.stack && (
        <details>
          <summary className="text-xs text-gray-500 cursor-pointer">Where in the code</summary>
          <pre className="text-xs bg-gray-100 rounded p-2 mt-1 whitespace-pre-wrap break-words">{r.stack}</pre>
        </details>
      )}
      {!r.resolved_at && (
        <ActionForm action={markErrorFixed}>
          <input type="hidden" name="id" value={r.id} />
          <button type="submit" className="text-sm border-2 border-[var(--color-primary)] rounded px-3 py-1">
            Mark fixed
          </button>
        </ActionForm>
      )}
    </div>
  );
}
