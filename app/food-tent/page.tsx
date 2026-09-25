import { createClient } from "@/lib/supabase/server";
import type {
  FoodTentItem,
  FoodTentSignup,
  FoodTentStatus,
  FoodTentWishlistItem,
  FoodTentWishlistSignup,
  Profile,
  ScheduleEvent,
} from "@/lib/database.types";
import { EventForm } from "./EventForm";
import { ItemForm } from "./ItemForm";
import { ItemRow } from "./ItemRow";
import { SignupControl } from "./SignupControl";
import { ImportItemsForm } from "./ImportItemsForm";
import { WishlistItemForm } from "./WishlistItemForm";
import { WishlistItemRow } from "./WishlistItemRow";
import { WishlistSignupControl } from "./WishlistSignupControl";
import { PublishControl } from "./PublishControl";
import { EventIcon } from "@/components/EventIcon";

const STATUS_LABEL: Record<FoodTentStatus["status"], string> = {
  draft: "Draft",
  pending_confirmation: "Auto-filled from last regatta — needs your review",
  published: "Published",
};

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
  const isManager = Boolean(
    caller?.role === "admin" || caller?.role === "coach" || caller?.is_tent_leader
  );

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

  const { data: wishlistItemsData } = await supabase
    .from("food_tent_wishlist_items")
    .select("*")
    .order("created_at", { ascending: true });
  const wishlistItems = (wishlistItemsData as FoodTentWishlistItem[] | null) ?? [];

  const { data: wishlistSignupsData } = await supabase
    .from("food_tent_wishlist_signups")
    .select("*");
  const wishlistSignups = (wishlistSignupsData as FoodTentWishlistSignup[] | null) ?? [];

  const { data: statusData } = await supabase.from("food_tent_status").select("*");
  const statusByEvent = new Map(
    ((statusData as FoodTentStatus[] | null) ?? []).map((s) => [s.event_id, s])
  );

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

      <div className="mb-10">
        <h2 className="text-lg font-semibold">Wish List</h2>
        <p className="text-sm text-gray-500">
          Equipment and supplies the food tent could use, not tied to a specific regatta.
        </p>

        <div className="mt-3 flex flex-col gap-3 max-w-lg">
          {wishlistItems.length === 0 && (
            <p className="text-sm text-gray-500">
              Nothing on the wish list yet{isManager ? " — add one below." : "."}
            </p>
          )}

          {wishlistItems.map((item) => {
            const itemSignups = wishlistSignups.filter((s) => s.item_id === item.id);
            const totalSignedUp = itemSignups.reduce((sum, s) => sum + s.quantity, 0);
            const mySignup = itemSignups.find((s) => s.user_id === user?.id);
            const fullyClaimed = totalSignedUp >= item.quantity_needed;

            return (
              <div key={item.id} className="border rounded-lg p-3">
                <WishlistItemRow
                  item={item}
                  totalSignedUp={totalSignedUp}
                  signupCount={itemSignups.length}
                  showFullyClaimed={fullyClaimed && !mySignup}
                  isManager={isManager}
                />

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
                  <WishlistSignupControl itemId={item.id} myQuantity={mySignup?.quantity ?? null} />
                </div>
              </div>
            );
          })}

          {isManager && <WishlistItemForm />}
        </div>
      </div>

      {isManager && <EventForm />}

      {events.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">
          No regatta days set up yet{isManager ? " — add one above." : "."}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-8">
        {events.map((event) => {
          const eventItems = items.filter((i) => i.event_id === event.id);
          const status = statusByEvent.get(event.id);
          const canPublish = isManager && status?.status !== "published" && eventItems.length > 0;
          return (
            <div key={event.id}>
              <h2 className="flex items-center gap-1.5 text-lg font-semibold">
                <EventIcon title={event.title} iconUrl={event.icon_url} className="w-6 h-6" />
                {event.title}{" "}
                <span className="text-sm font-normal text-gray-500">
                  {new Date(event.starts_at).toLocaleDateString()}
                  {event.location ? ` · ${event.location}` : ""}
                </span>
              </h2>
              {isManager && status && status.status !== "published" && (
                <p className="text-sm text-amber-700">{STATUS_LABEL[status.status]}</p>
              )}
              {canPublish && (
                <div className="mt-2">
                  <PublishControl eventId={event.id} />
                </div>
              )}

              <div className="mt-3 flex flex-col gap-3 max-w-lg">
                {eventItems.map((item) => {
                  const itemSignups = signups.filter((s) => s.item_id === item.id);
                  const totalSignedUp = itemSignups.reduce((sum, s) => sum + s.quantity, 0);
                  const mySignup = itemSignups.find((s) => s.user_id === user?.id);
                  const fullyClaimed = totalSignedUp >= item.quantity_needed;

                  return (
                    <div key={item.id} className="border rounded-lg p-3">
                      <ItemRow
                        item={item}
                        totalSignedUp={totalSignedUp}
                        signupCount={itemSignups.length}
                        showFullyClaimed={fullyClaimed && !mySignup}
                        isManager={isManager}
                      />

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

                {isManager && (
                  <div className="flex flex-col gap-3">
                    <ItemForm eventId={event.id} />
                    <ImportItemsForm eventId={event.id} />
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
