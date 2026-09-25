import Link from "next/link";
import { notFound } from "next/navigation";
import { Sailboat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ScheduleEvent, VolunteerNeed, VolunteerSignup } from "@/lib/database.types";
import { NeedForm } from "../NeedForm";
import { NeedRow } from "../NeedRow";
import { SignupControl } from "../SignupControl";
import { ImportNeedsForm } from "../ImportNeedsForm";

export default async function VolunteerEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event } = await supabase
    .from("schedule_events")
    .select("*")
    .eq("id", eventId)
    .single();
  if (!event) notFound();
  const typedEvent = event as ScheduleEvent;

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, is_tent_leader")
    .eq("id", user?.id ?? "")
    .single();
  const caller = callerProfile as { role: string; is_tent_leader: boolean } | null;
  const isManager = Boolean(
    caller?.role === "admin" || caller?.role === "coach" || caller?.is_tent_leader
  );

  const { data: needsData } = await supabase
    .from("volunteer_needs")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  const needs = (needsData as VolunteerNeed[] | null) ?? [];

  const { data: signupsData } = needs.length
    ? await supabase
        .from("volunteer_signups")
        .select("*")
        .in(
          "need_id",
          needs.map((n) => n.id)
        )
    : { data: [] as VolunteerSignup[] };
  const signups = (signupsData as VolunteerSignup[] | null) ?? [];

  const { data: profilesData } = await supabase.from("profiles").select("id, display_name");
  const profileNames = new Map(
    ((profilesData as Pick<Profile, "id" | "display_name">[] | null) ?? []).map((p) => [
      p.id,
      p.display_name,
    ])
  );

  return (
    <div className="min-h-screen p-8">
      <Link href="/volunteer" className="text-sm text-gray-500 hover:underline">
        ← Volunteer Needs
      </Link>

      <h1 className="flex items-center gap-2 text-2xl font-bold mt-4 mb-1">
        <Sailboat className="w-7 h-7 shrink-0" />
        {typedEvent.title}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {new Date(typedEvent.starts_at).toLocaleDateString()}
        {typedEvent.location ? ` · ${typedEvent.location}` : ""}
      </p>

      <div className="flex flex-col gap-3 max-w-lg">
        {needs.length === 0 && (
          <p className="text-sm text-gray-500">
            No volunteer slots posted yet{isManager ? " — add one below." : "."}
          </p>
        )}

        {needs.map((need) => {
          const needSignups = signups.filter((s) => s.need_id === need.id);
          const mySignedUp = needSignups.some((s) => s.user_id === user?.id);
          const full = needSignups.length >= need.slots_needed;

          return (
            <div key={need.id} className="border rounded-lg p-3">
              <NeedRow
                need={need}
                slotsFilled={needSignups.length}
                signupCount={needSignups.length}
                isManager={isManager}
              />

              {needSignups.length > 0 && (
                <ul className="text-sm text-gray-500 mt-2 list-disc list-inside">
                  {needSignups.map((s) => (
                    <li key={s.user_id}>{profileNames.get(s.user_id) ?? "Someone"}</li>
                  ))}
                </ul>
              )}

              <div className="mt-2">
                <SignupControl needId={need.id} signedUp={mySignedUp} full={full && !mySignedUp} />
              </div>
            </div>
          );
        })}

        {isManager && (
          <div className="flex flex-col gap-3">
            <NeedForm eventId={typedEvent.id} />
            <ImportNeedsForm eventId={typedEvent.id} />
          </div>
        )}
      </div>
    </div>
  );
}
