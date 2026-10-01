import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "@/components/ActionForm";
import { consoleUser, formatWhen } from "@/lib/console";
import { RECRUIT_URL } from "@/lib/site";
import type { Recruiter } from "@/lib/recruitServer";
import { setRecruiterStatus } from "../actions";
import { Badge, Card, ConsolePage, NotGlobalAdmin } from "../ui";

// College coaches who signed up for recruiting (0121). Check each one is
// really a coach at that school (the athletics site's staff page) before
// approving.
export default async function RecruitersPage() {
  const me = await consoleUser();
  if (!me) return <NotGlobalAdmin />;

  const admin = createAdminClient();
  const [{ data }, { data: contactRows }, { count: listed }] = await Promise.all([
    admin.from("recruiters").select("*").order("created_at", { ascending: false }),
    admin.from("recruit_contacts").select("recruiter_id"),
    admin.from("recruit_listings").select("profile_id", { count: "exact", head: true }).eq("shown", true),
  ]);
  const recruiters = (data as Recruiter[] | null) ?? [];
  const sent = new Map<string, number>();
  for (const c of (contactRows as { recruiter_id: string }[] | null) ?? []) sent.set(c.recruiter_id, (sent.get(c.recruiter_id) ?? 0) + 1);
  const pending = recruiters.filter((r) => r.status === "pending");
  const others = recruiters.filter((r) => r.status !== "pending");

  const row = (r: Recruiter) => (
    <li key={r.user_id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>
        <span className="font-medium">{r.name}</span>
        {r.title ? `, ${r.title}` : ""} · {r.school}{" "}
        <Badge tone={r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "amber"}>{r.status}</Badge>
        <span className="block text-xs text-gray-500">
          {r.email} · signed up {formatWhen(r.created_at)} · {sent.get(r.user_id) ?? 0} messages sent
        </span>
      </span>
      <span className="flex gap-2">
        {(["approved", "rejected"] as const)
          .filter((s) => s !== r.status)
          .map((s) => (
            <ActionForm key={s} action={setRecruiterStatus}>
              <input type="hidden" name="user_id" value={r.user_id} />
              <input type="hidden" name="status" value={s} />
              <button
                type="submit"
                className={`text-xs rounded px-2 py-1 border ${s === "approved" ? "border-green-400 text-green-800" : "border-red-300 text-red-700"}`}
              >
                {s === "approved" ? "Approve" : r.status === "approved" ? "Remove access" : "Turn down"}
              </button>
            </ActionForm>
          ))}
      </span>
    </li>
  );

  return (
    <ConsolePage
      title="College coaches"
      subtitle={
        <>
          They sign up at {RECRUIT_URL} with a .edu email and see athletes once approved. {listed ?? 0} athletes are
          listed. Before approving, check the school&apos;s athletics staff page lists them.
        </>
      }
    >
      <Card title={`Waiting for approval (${pending.length})`}>
        {pending.length ? <ul className="flex flex-col divide-y">{pending.map(row)}</ul> : <p className="text-sm text-gray-500">Nobody waiting.</p>}
      </Card>
      {others.length > 0 && (
        <Card title="Approved and turned down">
          <ul className="flex flex-col divide-y">{others.map(row)}</ul>
        </Card>
      )}
    </ConsolePage>
  );
}
