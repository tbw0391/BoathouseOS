import { createClient } from "@/lib/supabase/server";
import type { MaintenanceRequest, Profile } from "@/lib/database.types";
import { RequestForm } from "../maintenance/RequestForm";
import { RequestRow } from "../maintenance/RequestRow";

export default async function SiteMaintenancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: callerData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const callerRole = (callerData as { role: string } | null)?.role;
  const isStaff = callerRole === "admin" || callerRole === "coach";

  const { data: requestsData } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("type", "site")
    .order("created_at", { ascending: false });
  const requests = (requestsData as MaintenanceRequest[] | null) ?? [];

  const submitterIds = [...new Set(requests.map((r) => r.submitted_by).filter((id): id is string => !!id))];
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
      <h1 className="text-2xl font-bold mb-6">Site Maintenance</h1>

      <RequestForm
        type="site"
        placeholder="What needs attention at the boathouse/site? (e.g. broken dock light, locked gate...)"
      />

      {requests.length > 0 && (
        <div className="mt-8 flex flex-col gap-3 max-w-md">
          <h2 className="text-sm font-medium text-gray-600">
            {isStaff ? "All requests" : "Your requests"}
          </h2>
          {requests.map((r) =>
            isStaff ? (
              <RequestRow
                key={r.id}
                type="site"
                request={r}
                submitterName={r.submitted_by ? nameById.get(r.submitted_by) ?? "Unknown" : "Unknown"}
              />
            ) : (
              <div key={r.id} className="border rounded-lg p-4">
                <p className="text-sm">{r.description}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(r.created_at).toLocaleDateString()}
                  {r.status === "resolved" && " · Resolved"}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
