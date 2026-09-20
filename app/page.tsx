import Link from "next/link";
import {
  Users,
  Calendar,
  Waves,
  Dumbbell,
  Tent,
  HelpingHand,
  ShoppingBag,
  MessageCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { FoodTentItem, FoodTentSignup, ScheduleEvent } from "@/lib/database.types";
import { parseStoreItems } from "@/lib/storeItems";

const sections = [
  { href: "/roster", label: "Roster", icon: Users },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/lineups", label: "Lineups", icon: Waves },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/food-tent", label: "Food Tent", icon: Tent },
  { href: "/volunteer", label: "Volunteer Needs", icon: HelpingHand },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settingsData } = await supabase
    .from("club_settings")
    .select("key, value")
    .in("key", ["team_store_url", "team_store_featured_items"]);
  const settingsByKey = new Map(
    ((settingsData as { key: string; value: string | null }[] | null) ?? []).map((s) => [s.key, s.value])
  );
  const storeUrl = settingsByKey.get("team_store_url") ?? null;
  const featuredItems = parseStoreItems(settingsByKey.get("team_store_featured_items") ?? null);

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

      {storeUrl && (
        <div className="w-full max-w-md rounded-xl border-2 border-[#022e5d] overflow-hidden">
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-[#022e5d] text-white px-5 py-4 hover:bg-[#01213f] transition-colors"
          >
            <ShoppingBag className="w-7 h-7 shrink-0" />
            <div>
              <p className="text-lg font-bold leading-tight">Team Store</p>
              <p className="text-sm text-white/80">Shop official Westerville Crew gear →</p>
            </div>
          </a>
          {featuredItems.length > 0 && (
            <div className="grid grid-cols-2 gap-px bg-[#022e5d]/20">
              {featuredItems.slice(0, 4).map((item) => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white p-3 hover:bg-gray-50 transition-colors"
                >
                  {item.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-20 object-cover rounded mb-2"
                    />
                  )}
                  <p className="text-sm font-medium leading-tight">{item.title}</p>
                  {item.price && <p className="text-xs text-gray-500 mt-0.5">{item.price}</p>}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="w-full max-w-md grid grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex flex-col items-center justify-center gap-2 text-center rounded-lg border-2 border-[#022e5d] px-4 py-6 font-medium hover:bg-[#404040] hover:text-white transition-colors"
          >
            <s.icon className="w-6 h-6" />
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
