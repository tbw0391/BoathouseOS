import { createClient } from "@/lib/supabase/server";
import type { Profile, Suggestion } from "@/lib/database.types";
import { SuggestionForm } from "./SuggestionForm";
import { SuggestionRow } from "./SuggestionRow";

export default async function SuggestionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: callerData } = await supabase
    .from("profiles")
    .select("role, is_board_member")
    .eq("id", user.id)
    .single();
  const caller = callerData as { role: string; is_board_member: boolean } | null;
  const isAdmin = caller?.role === "admin";
  // Club suggestions are one shared list for admins, coaches and board
  // members (0116); app suggestions go to the BoathouseOS console.
  const isReviewer = isAdmin || caller?.role === "coach" || Boolean(caller?.is_board_member);

  const { data: suggestionsData } = await supabase
    .from("suggestions")
    .select("*")
    .order("created_at", { ascending: false });
  const suggestions = (suggestionsData as Suggestion[] | null) ?? [];

  const submitterIds = [...new Set(suggestions.map((s) => s.submitted_by).filter((id): id is string => !!id))];
  const { data: submittersData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", submitterIds.length > 0 ? submitterIds : [""]);
  const nameById = new Map(
    ((submittersData as Pick<Profile, "id" | "display_name">[] | null) ?? []).map((p) => [
      p.id,
      p.display_name,
    ])
  );

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Suggestions</h1>

      <SuggestionForm />

      {suggestions.length > 0 && (
        <div className="mt-8 flex flex-col gap-3 max-w-md">
          <h2 className="text-sm font-medium text-gray-600">
            {isReviewer ? "Club suggestions (and your own)" : "Your suggestions"}
          </h2>
          {suggestions.map((s) =>
            isReviewer && s.category === "club" ? (
              <SuggestionRow
                key={s.id}
                suggestion={s}
                canDelete={isAdmin}
                submitterName={
                  s.submitted_by ? nameById.get(s.submitted_by) ?? "Unknown" : "Unknown"
                }
              />
            ) : (
              <div key={s.id} className="border rounded-lg p-4">
                <span className="self-start text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5 bg-gray-100 text-gray-600">
                  {s.category === "app" ? "App" : "Club"}
                </span>
                <p className="text-sm mt-2">{s.body}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(s.created_at).toLocaleDateString()}
                  {s.category === "app" && " · Sent to the BoathouseOS team"}
                  {s.status === "reviewed" && " · Reviewed"}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
