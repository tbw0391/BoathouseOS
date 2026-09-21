import Link from "next/link";
import Image from "next/image";
import {
  Users,
  Calendar,
  Waves,
  Dumbbell,
  Tent,
  HelpingHand,
  ShoppingBag,
  MessageCircle,
  Camera,
  Lightbulb,
  ListTodo,
  Wrench,
  Hammer,
  Navigation,
  MapPin,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ChatGroup, FoodTentItem, FoodTentSignup, ScheduleEvent } from "@/lib/database.types";
import { parseStoreItems } from "@/lib/storeItems";
import { getUnreadChatCount } from "@/lib/chat";
import { getUnreadScheduleCount } from "@/lib/schedule";

const sections = [
  { href: "/roster", label: "Roster", icon: Users },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/lineups", label: "Lineups", icon: Waves },
  { href: "/on-water", label: "On the Water", icon: Navigation },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/food-tent", label: "Food Tent", icon: Tent },
  { href: "/volunteer", label: "Volunteer Needs", icon: HelpingHand },
  { href: "/photos", label: "Photos", icon: Camera },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/suggestions", label: "Suggestions", icon: Lightbulb },
  { href: "/boat-maintenance", label: "Boat Maintenance", icon: Wrench },
  { href: "/site-maintenance", label: "Site Maintenance", icon: Hammer },
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
  let upcomingRegatta: ScheduleEvent | null = null;
  let unreadCount = 0;
  let unreadScheduleCount = 0;
  let coachChatHref = "/messages";
  let isAdmin = false;
  let isCoachOrAdmin = false;

  if (user) {
    unreadCount = await getUnreadChatCount(user.id);
    unreadScheduleCount = await getUnreadScheduleCount(user.id);

    const { data: callerData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const callerRole = (callerData as { role: string } | null)?.role;
    isAdmin = callerRole === "admin";
    isCoachOrAdmin = callerRole === "admin" || callerRole === "coach";

    const { data: coachGroup } = await supabase
      .from("chat_groups")
      .select("id")
      .eq("team", "coach")
      .maybeSingle();
    if ((coachGroup as Pick<ChatGroup, "id"> | null)?.id) {
      coachChatHref = `/messages/${(coachGroup as Pick<ChatGroup, "id">).id}`;
    }
  }

  if (user) {
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { data: regattaData } = await supabase
      .from("schedule_events")
      .select("*")
      .eq("event_type", "regatta")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", weekOut.toISOString())
      .order("starts_at", { ascending: true })
      .limit(1);
    upcomingRegatta = ((regattaData as ScheduleEvent[] | null) ?? [])[0] ?? null;
  }

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
        <Image
          src="/branding/logo-full.png"
          alt="Westerville Crew"
          width={480}
          height={530}
          priority
          className="w-40 h-auto mx-auto"
        />
      </div>

      {upcomingRegatta && (
        <div className="w-full max-w-md flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">
            {upcomingRegatta.title} is coming up on{" "}
            {new Date(upcomingRegatta.starts_at).toLocaleDateString()} — get ready:
          </p>
          <Link
            href="/food-tent"
            className="flex items-center gap-3 bg-[#022e5d] text-white rounded-lg px-4 py-3 text-sm hover:bg-[#01213f] transition-colors"
          >
            <Tent className="w-5 h-5 shrink-0" />
            Sign up for the food tent
          </Link>
          <Link
            href="/lineups"
            className="flex items-center gap-3 bg-[#022e5d] text-white rounded-lg px-4 py-3 text-sm hover:bg-[#01213f] transition-colors"
          >
            <Waves className="w-5 h-5 shrink-0" />
            Check the lineups
          </Link>
          <Link
            href={coachChatHref}
            className="flex items-center gap-3 bg-[#022e5d] text-white rounded-lg px-4 py-3 text-sm hover:bg-[#01213f] transition-colors"
          >
            <MessageCircle className="w-5 h-5 shrink-0" />
            Read coaches&apos; messages
          </Link>
        </div>
      )}

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
        {(isCoachOrAdmin
          ? [...sections, { href: "/coach/tracking", label: "Live Tracking", icon: MapPin }]
          : sections
        )
          .concat(isAdmin ? [{ href: "/todo", label: "To-do List", icon: ListTodo }] : [])
          .map((s) => {
          const badgeCount =
            s.href === "/messages" ? unreadCount : s.href === "/schedule" ? unreadScheduleCount : 0;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="relative flex flex-col items-center justify-center gap-2 text-center rounded-lg border-2 border-[#022e5d] px-4 py-6 font-medium hover:bg-[#404040] hover:text-white transition-colors"
            >
              <s.icon className="w-6 h-6" />
              {s.label}
              {badgeCount > 0 && (
                <span className="absolute top-2 right-2 min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-xs">
                  {badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

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
    </div>
  );
}
