import Link from "next/link";
import { ClipboardList, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";

export default async function CoachHubPage() {
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
        <h1 className="text-2xl font-bold mb-6">Coach</h1>
        <p className="text-sm text-gray-500">Only coaches and admins can view this section.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Coach</h1>
      <div className="flex flex-col gap-3 max-w-sm">
        <Link
          href="/coach/tasks"
          className="flex items-center gap-3 rounded-lg border-2 border-[var(--color-primary)] px-4 py-3 font-medium hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
        >
          <ClipboardList className="w-5 h-5" />
          Coach Tasks
        </Link>
        <Link
          href="/coach/tracking"
          className="flex items-center gap-3 rounded-lg border-2 border-[var(--color-primary)] px-4 py-3 font-medium hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
        >
          <MapPin className="w-5 h-5" />
          Live Tracking
        </Link>
      </div>
    </div>
  );
}
