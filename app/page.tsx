import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { FoodTentItem, FoodTentSignup, ScheduleEvent } from "@/lib/database.types";

const sections = [
  { href: "/roster", label: "Roster" },
  { href: "/schedule", label: "Schedule" },
  { href: "/lineups", label: "Lineups" },
  { href: "/workouts", label: "Workouts" },
  { href: "/food-tent", label: "Food Tent" },
  { href: "/volunteer", label: "Volunteer Needs" },
  { href: "/store", label: "Team Store" },
  { href: "/messages", label: "Messages" },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let banners: { title: string; quantity: number; eventTitle: string; eventDate: string }[] = [];

  if (user) {
    const { data: signupsData } = await supabase
      .from("food_tent_signups")
      .select("*")
      .eq("user_id", user.id);
    const signups = (signupsData as FoodTentSignup[] | null) ?? [];

    if (signups.length > 0) {
      const itemIds = signups.map((s) => s.item_id);
      const { data: itemsData } = await supabase
        .from("food_tent_items")
        .select("*")
        .in("id", itemIds);
      const items = (itemsData as FoodTentItem[] | null) ?? [];

      const eventIds = [...new Set(items.map((i) => i.event_id))];
      const { data: eventsData } = await supabase
        .from("schedule_events")
        .select("*")
        .in("id", eventIds)
        .gte("starts_at", new Date().toISOString());
      const events = (eventsData as ScheduleEvent[] | null) ?? [];
      const eventById = new Map(events.map((e) => [e.id, e]));

      banners = signups
        .map((s) => {
          const item = items.find((i) => i.id === s.item_id);
          const event = item ? eventById.get(item.event_id) : undefined;
          if (!item || !event) return null;
          return {
            title: item.title,
            quantity: s.quantity,
            eventTitle: event.title,
            eventDate: new Date(event.starts_at).toLocaleDateString(),
          };
        })
        .filter((b): b is NonNullable<typeof b> => b !== null);
    }
  }

  return (
    <div className="min-h-screen p-8 flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">W-Crew-app</h1>
        <p className="text-sm text-gray-500">Westerville Rowing Club</p>
      </div>

      {banners.length > 0 && (
        <div className="w-full max-w-md flex flex-col gap-2">
          {banners.map((b, i) => (
            <div
              key={i}
              className="bg-[#022e5d] text-white rounded-lg px-4 py-3 text-sm"
            >
              🍪 You&apos;re bringing <strong>{b.quantity}x {b.title}</strong> to{" "}
              {b.eventTitle} ({b.eventDate})
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-md grid grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center justify-center text-center rounded-lg border-2 border-[#022e5d] px-4 py-6 font-medium hover:bg-[#404040] hover:text-white transition-colors"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
