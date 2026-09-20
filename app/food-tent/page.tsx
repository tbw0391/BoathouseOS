import { createClient } from "@/lib/supabase/server";
import type { FoodTentItem, FoodTentSignup, Profile, ScheduleEvent } from "@/lib/database.types";
import { EventForm } from "./EventForm";
import { ItemForm } from "./ItemForm";
import { SignupControl } from "./SignupControl";

export default async function FoodTentPage() {
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
  const isManager = caller?.role === "admin" || caller?.role === "coach" || caller?.is_tent_leader;

  const { data: eventsData } = await supabase
    .from("schedule_events")
    .select("*")
    .eq("event_type", "regatta")
    .order("starts_at", { ascending: true });
  const events = (eventsData as ScheduleEvent[] | null) ?? [];

  const { data: itemsData } = await supabase
    .from("food_tent_items")
    .select("*")
    .order("created_at", { ascending: true });
  const items = (itemsData as FoodTentItem[] | null) ?? [];

  const { data: signupsData } = await supabase.from("food_tent_signups").select("*");
  const signups = (signupsData as FoodTentSignup[] | null) ?? [];

  const { data: profilesData } = await supabase.from("profiles").select("id, display_name");
  const profileNames = new Map(
    ((profilesData as Pick<Profile, "id" | "display_name">[] | null) ?? []).map((p) => [
      p.id,
      p.display_name,
    ])
  );

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Food Tent</h1>

      {isManager && <EventForm />}

      {events.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">
          No regatta days set up yet{isManager ? " — add one above." : "."}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-8">
        {events.map((event) => {
          const eventItems = items.filter((i) => i.event_id === event.id);
          return (
            <div key={event.id}>
              <h2 className="text-lg font-semibold">
                {event.title}{" "}
                <span className="text-sm font-normal text-gray-500">
                  {new Date(event.starts_at).toLocaleDateString()}
                  {event.location ? ` · ${event.location}` : ""}
                </span>
              </h2>

              <div className="mt-3 flex flex-col gap-3 max-w-lg">
                {eventItems.map((item) => {
                  const itemSignups = signups.filter((s) => s.item_id === item.id);
                  const totalSignedUp = itemSignups.reduce((sum, s) => sum + s.quantity, 0);
                  const mySignup = itemSignups.find((s) => s.user_id === user?.id);
                  const fullyClaimed = totalSignedUp >= item.quantity_needed;

                  return (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {item.title}{" "}
                            <span className="text-sm text-gray-500">
                              ({totalSignedUp}/{item.quantity_needed})
                            </span>
                          </p>
                          {item.notes && (
                            <p className="text-sm text-gray-500">{item.notes}</p>
                          )}
                        </div>
                        {fullyClaimed && !mySignup && (
                          <span className="text-sm text-gray-500">Fully claimed</span>
                        )}
                      </div>

                      {itemSignups.length > 0 && (
                        <ul className="text-sm text-gray-500 mt-2 list-disc list-inside">
                          {itemSignups.map((s) => (
                            <li key={s.user_id}>
                              {profileNames.get(s.user_id) ?? "Someone"} — {s.quantity}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-2">
                        <SignupControl
                          itemId={item.id}
                          myQuantity={mySignup?.quantity ?? null}
                        />
                      </div>
                    </div>
                  );
                })}

                {isManager && <ItemForm eventId={event.id} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
