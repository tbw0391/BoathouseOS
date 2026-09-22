import { createClient } from "@/lib/supabase/server";
import type { CoachAnnouncement, Profile } from "@/lib/database.types";
import { AnnouncementForm } from "./AnnouncementForm";
import { AnnouncementRow } from "./AnnouncementRow";

export default async function AnnouncementsPage() {
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
  const isCoachOrAdmin = callerRole === "coach" || callerRole === "admin";

  // RLS already scopes this to announcements the caller is allowed to see:
  // matching audience for rowers/coxswains/parents, everything for staff.
  const { data: announcementsData } = await supabase
    .from("coach_announcements")
    .select("*")
    .order("created_at", { ascending: false });
  const announcements = (announcementsData as CoachAnnouncement[] | null) ?? [];

  const senderIds = [...new Set(announcements.map((a) => a.sender_id).filter((id): id is string => !!id))];
  const { data: sendersData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", senderIds.length > 0 ? senderIds : [""]);
  const nameById = new Map(
    ((sendersData as Pick<Profile, "id" | "display_name">[] | null) ?? []).map((p) => [p.id, p.display_name])
  );

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Announcements</h1>

      {isCoachOrAdmin && <AnnouncementForm />}

      {announcements.length > 0 ? (
        <div className="mt-8 flex flex-col gap-3 max-w-md">
          {announcements.map((a) => (
            <AnnouncementRow
              key={a.id}
              announcement={a}
              senderName={a.sender_id ? nameById.get(a.sender_id) ?? "Unknown" : "Unknown"}
              canManage={isCoachOrAdmin}
            />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-gray-500">No announcements yet.</p>
      )}
    </div>
  );
}
