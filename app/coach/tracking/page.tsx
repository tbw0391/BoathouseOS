import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";
import { getActiveBoats } from "@/lib/onWater";
import { LiveBoats } from "./LiveBoats";

export default async function CoachTrackingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();
  const callerRole = (callerProfile as Pick<Profile, "role"> | null)?.role;
  const canView = callerRole === "coach" || callerRole === "admin";

  if (!canView) {
    return (
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-6">Live Tracking</h1>
        <p className="text-sm text-gray-500">Only coaches and admins can view live tracking.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Live Tracking</h1>
      <LiveBoats initialSessions={await getActiveBoats()} mapOpenByDefault />
    </div>
  );
}
