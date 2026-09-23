import { createClient } from "@/lib/supabase/server";
import type { Profile, ScheduleEvent, VolunteerNeed, VolunteerSignup } from "@/lib/database.types";
import { NeedForm } from "./NeedForm";
import { NeedRow } from "./NeedRow";
import { SignupControl } from "./SignupControl";
import { ImportNeedsForm } from "./ImportNeedsForm";
import { EventIcon } from "@/components/EventIcon";

export default async function VolunteerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, is_tent_leader")
    .eq("id", user?.id ?? "")
    .single();
  const caller = callerProfile as { role: string; is_tent_leader: boolean } | null;
  const isManager = Boolean(
    caller?.role === "admin" || caller?.role === "coach" || caller?.is_tent_leader
  );

  const { data: eventsData } = await supabase
    .from("schedule_events")
    .select("*")
    .eq("event_type", "regatta")
    .order("starts_at", { ascending: true });
  const events = (eventsData as ScheduleEvent[] | null) ?? [];

  const { data: needsData } = await supabase
    .from("volunteer_needs")
    .select("*")
    .order("created_at", { ascending: true });
  const needs = (needsData as VolunteerNeed[] | null) ?? [];

  const { data: signupsData } = await supabase.from("volunteer_signups").select("*");
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
      <h1 className="text-2xl font-bold mb-4">Volunteer Needs</h1>

      {events.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">No regatta days set up yet.</p>
      )}

      <div className="mt-6 flex flex-col gap-8">
        {events.map((event) => {
          const eventNeeds = needs.filter((n) => n.event_id === event.id);
          return (
            <div key={event.id}>
              <h2 className="flex items-center gap-1.5 text-lg font-semibold">
                <EventIcon title={event.title} className="w-6 h-6" />
                {event.title}{" "}
                <span className="text-sm font-normal text-gray-500">
                  {new Date(event.starts_at).toLocaleDateString()}
                  {event.location ? ` · ${event.location}` : ""}
                </span>
              </h2>

              <div className="mt-3 flex flex-col gap-3 max-w-lg">
                {eventNeeds.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No volunteer slots posted yet{isManager ? " — add one below." : "."}
                  </p>
                )}

                {eventNeeds.map((need) => {
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
                    <NeedForm eventId={event.id} />
                    <ImportNeedsForm eventId={event.id} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
