import { createAdminClient } from "@/lib/supabase/admin";
import { consoleUser, formatWhen } from "@/lib/console";
import { ActionForm } from "@/components/ActionForm";
import { deleteAppSuggestion, setAppSuggestionStatus } from "../actions";
import { Card, ConsolePage, NotGlobalAdmin, outlineButtonClass } from "../ui";

type Row = { id: string; body: string; status: string; created_at: string; club_id: string; submitted_by: string | null };

// "This app" suggestions from every club (0116). Club suggestions stay
// with each club's admins on /suggestions.
export default async function AppSuggestionsPage() {
  if (!(await consoleUser())) return <NotGlobalAdmin />;

  const admin = createAdminClient();
  const { data } = await admin
    .from("suggestions")
    .select("id, body, status, created_at, club_id, submitted_by")
    .eq("category", "app")
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = (data as Row[] | null) ?? [];
  const senderIds = [...new Set(rows.map((r) => r.submitted_by).filter((id): id is string => !!id))];
  const [{ data: clubData }, { data: peopleData }] = await Promise.all([
    admin.from("clubs").select("id, name"),
    senderIds.length ? admin.from("profiles").select("id, display_name, role").in("id", senderIds) : Promise.resolve({ data: [] }),
  ]);
  const clubName = new Map(((clubData as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));
  const person = new Map(
    ((peopleData as { id: string; display_name: string; role: string }[] | null) ?? []).map((p) => [p.id, p])
  );
  const fresh = rows.filter((r) => r.status !== "reviewed");
  const reviewed = rows.filter((r) => r.status === "reviewed");

  const card = (r: Row) => {
    const who = r.submitted_by ? person.get(r.submitted_by) : undefined;
    return (
      <div key={r.id} className={`border rounded-lg p-3 flex flex-col gap-2 bg-white ${r.status === "reviewed" ? "opacity-60" : ""}`}>
        <p className="text-sm whitespace-pre-line">{r.body}</p>
        <p className="text-xs text-gray-500">
          {who ? `${who.display_name} (${who.role})` : "Someone"} · {clubName.get(r.club_id) ?? "Unknown club"} ·{" "}
          {formatWhen(r.created_at)}
        </p>
        <div className="flex gap-2">
          <ActionForm action={setAppSuggestionStatus}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="status" value={r.status === "reviewed" ? "new" : "reviewed"} />
            <button type="submit" className={outlineButtonClass}>
              {r.status === "reviewed" ? "Mark new" : "Mark reviewed"}
            </button>
          </ActionForm>
          <ActionForm action={deleteAppSuggestion}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" className="text-sm text-red-600 border-2 border-red-300 rounded-lg px-3 py-1.5">
              Delete
            </button>
          </ActionForm>
        </div>
      </div>
    );
  };

  return (
    <ConsolePage
      title="App suggestions"
      subtitle="Ideas and bugs members sent about BoathouseOS itself, from every club. You get an email for each new one."
    >
      <Card title={`New (${fresh.length})`}>
        {fresh.length === 0 ? <p className="text-sm text-gray-500">Nothing new.</p> : fresh.map(card)}
      </Card>
      {reviewed.length > 0 && (
        <Card title={`Reviewed (${reviewed.length})`}>
          {reviewed.map(card)}
        </Card>
      )}
    </ConsolePage>
  );
}
