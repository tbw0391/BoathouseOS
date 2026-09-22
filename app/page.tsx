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
  Settings,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type {
  ChatGroup,
  FamilyLink,
  FoodTentItem,
  FoodTentSignup,
  Lineup,
  LineupSeat,
  Profile,
  Race,
  ScheduleEvent,
} from "@/lib/database.types";
import { parseStoreItems } from "@/lib/storeItems";
import { getUnreadChatCount } from "@/lib/chat";
import { getUnreadScheduleCount } from "@/lib/schedule";
import { NAV_SECTIONS, resolveNavVisibility } from "@/lib/navSections";

const ICONS_BY_HREF: Record<string, LucideIcon> = {
  "/roster": Users,
  "/schedule": Calendar,
  "/lineups": Waves,
  "/on-water": Navigation,
  "/workouts": Dumbbell,
  "/food-tent": Tent,
  "/volunteer": HelpingHand,
  "/photos": Camera,
  "/messages": MessageCircle,
  "/polls": Vote,
  "/suggestions": Lightbulb,
  "/boat-maintenance": Wrench,
  "/site-maintenance": Hammer,
  "/coach/tracking": MapPin,
  "/todo": ListTodo,
  "/admin": Settings,
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settingsData } = await supabase
    .from("club_settings")
    .select("key, value")
    .in("key", ["team_store_url", "team_store_featured_items", "nav_visibility", "nav_disabled_hrefs"]);
  const settingsByKey = new Map(
    ((settingsData as { key: string; value: string | null }[] | null) ?? []).map((s) => [s.key, s.value])
  );
  const storeUrl = settingsByKey.get("team_store_url") ?? null;
  const featuredItems = parseStoreItems(settingsByKey.get("team_store_featured_items") ?? null);
  const navVisibilityByHref = resolveNavVisibility(settingsByKey);

  let banners: {
    eventTitle: string;
    eventDate: string;
    items: { title: string; quantity: number }[];
  }[] = [];
  let upcomingRegatta: ScheduleEvent | null = null;
  let unreadCount = 0;
  let unreadScheduleCount = 0;
  let coachChatHref = "/messages";
  let isAdmin = false;
  let isCoachOrAdmin = false;
  let isParent = false;
  let isRowerOrCoxswain = false;

  let householdUserIds: string[] = [];

  if (user) {
    unreadCount = await getUnreadChatCount(user.id);
    unreadScheduleCount = await getUnreadScheduleCount(user.id);

    const { data: callerData } = await supabase
      .from("profiles")
      .select("role, spouse_id")
      .eq("id", user.id)
      .single();
    const caller = callerData as Pick<Profile, "role" | "spouse_id"> | null;
    const callerRole = caller?.role;
    isAdmin = callerRole === "admin";
    isCoachOrAdmin = callerRole === "admin" || callerRole === "coach";
    isParent = callerRole === "parent";
    isRowerOrCoxswain = callerRole === "rower" || callerRole === "coxswain";

    householdUserIds = [user.id];
    if (isParent) {
      // Spouses are linked one-directionally, so check both: the caller's
      // own spouse_id, and anyone whose spouse_id points back at the caller.
      const { data: reverseSpouses } = await supabase
        .from("profiles")
        .select("id")
        .eq("spouse_id", user.id);
      const spouseIds = new Set<string>(
        ((reverseSpouses as Pick<Profile, "id">[] | null) ?? []).map((p) => p.id)
      );
      if (caller?.spouse_id) spouseIds.add(caller.spouse_id);
      householdUserIds.push(...spouseIds);
    }

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
      .in("user_id", householdUserIds);
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

      const bannersByEvent = new Map<
        string,
        { eventTitle: string; eventDate: string; items: { title: string; quantity: number }[] }
      >();

      for (const s of signups) {
        const item = items.find((i) => i.id === s.item_id);
        const event = item ? eventById.get(item.event_id) : undefined;
        if (!item || !event) continue;

        const existing = bannersByEvent.get(event.id);
        if (existing) {
          existing.items.push({ title: item.title, quantity: s.quantity });
        } else {
          bannersByEvent.set(event.id, {
            eventTitle: event.title,
            eventDate: new Date(event.starts_at).toLocaleDateString(),
            items: [{ title: item.title, quantity: s.quantity }],
          });
        }
      }

      banners = [...bannersByEvent.values()];
    }
  }

  let lineupBanners: {
    rowerName: string | null;
    boatName: string;
    raceName: string | null;
    raceTimeLabel: string | null;
    eventTitle: string;
    eventDate: string;
  }[] = [];

  if (user) {
    // Whose lineup assignments this viewer should hear about: their own if
    // they're a rower/coxswain, or their linked rower/coxswain kid(s)' if
    // they're a parent (covering the whole household, not just whoever set
    // the family link).
    let lineupRowerIds: string[] = [];
    if (isRowerOrCoxswain) {
      lineupRowerIds = [user.id];
    } else if (isParent || isCoachOrAdmin) {
      const { data: familyLinkRows } = await supabase
        .from("family_links")
        .select("rower_id")
        .in("guardian_id", householdUserIds);
      lineupRowerIds = [
        ...new Set(
          ((familyLinkRows as Pick<FamilyLink, "rower_id">[] | null) ?? []).map((l) => l.rower_id)
        ),
      ];
    }

    if (lineupRowerIds.length > 0) {
      const { data: seatRows } = await supabase
        .from("lineup_seats")
        .select("*")
        .in("rower_id", lineupRowerIds);
      const seats = (seatRows as LineupSeat[] | null) ?? [];

      if (seats.length > 0) {
        const lineupIds = [...new Set(seats.map((s) => s.lineup_id))];
        const { data: lineupRows } = await supabase.from("lineups").select("*").in("id", lineupIds);
        const lineupsData = (lineupRows as Lineup[] | null) ?? [];
        const lineupById = new Map(lineupsData.map((l) => [l.id, l]));

        const eventIds = [
          ...new Set(lineupsData.map((l) => l.event_id).filter((id): id is string => !!id)),
        ];
        const { data: eventRows } = await supabase
          .from("schedule_events")
          .select("*")
          .in("id", eventIds)
          .gte("starts_at", new Date().toISOString());
        const eventsData = (eventRows as ScheduleEvent[] | null) ?? [];
        const eventById = new Map(eventsData.map((e) => [e.id, e]));

        const rowerNameById = new Map<string, string>();
        if (isParent || isCoachOrAdmin) {
          const { data: rowerNameRows } = await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", lineupRowerIds);
          for (const p of (rowerNameRows as Pick<Profile, "id" | "display_name">[] | null) ?? []) {
            rowerNameById.set(p.id, p.display_name);
          }
        }

        lineupBanners = seats
          .map((seat) => {
            if (!seat.rower_id) return null;
            const lineup = lineupById.get(seat.lineup_id);
            const event = lineup?.event_id ? eventById.get(lineup.event_id) : undefined;
            if (!lineup || !event) return null;
            return {
              rowerName: isParent || isCoachOrAdmin ? rowerNameById.get(seat.rower_id) ?? "Someone" : null,
              boatName: lineup.boat_name,
              raceName: lineup.race_name,
              raceTimeLabel: lineup.race_time
                ? new Date(lineup.race_time).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : null,
              eventTitle: event.title,
              eventDate: new Date(event.starts_at).toLocaleDateString(),
            };
          })
          .filter((b): b is NonNullable<typeof b> => b !== null);
      }
    }
  }

  // Coach/admin notification: races that have been collected (e.g. via a
  // heat sheet import) but don't have a boat/crew assigned yet.
  let pendingRaceBanners: { eventTitle: string; eventDate: string; count: number }[] = [];

  if (user && isCoachOrAdmin) {
    const { data: pendingRaceRows } = await supabase
      .from("races")
      .select("*")
      .is("lineup_id", null);
    const pendingRacesData = (pendingRaceRows as Race[] | null) ?? [];

    if (pendingRacesData.length > 0) {
      const eventIds = [...new Set(pendingRacesData.map((r) => r.event_id))];
      const { data: eventRows } = await supabase
        .from("schedule_events")
        .select("*")
        .in("id", eventIds)
        .gte("starts_at", new Date().toISOString());
      const eventsData = (eventRows as ScheduleEvent[] | null) ?? [];

      pendingRaceBanners = eventsData
        .map((event) => ({
          eventTitle: event.title,
          eventDate: new Date(event.starts_at).toLocaleDateString(),
          count: pendingRacesData.filter((r) => r.event_id === event.id).length,
        }))
        .filter((b) => b.count > 0);
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

      {pendingRaceBanners.length > 0 && (
        <div className="w-full max-w-md flex flex-col gap-2">
          {pendingRaceBanners.map((b, i) => (
            <Link
              key={i}
              href="/lineups"
              className="flex items-center gap-3 bg-[#022e5d] text-white rounded-lg px-4 py-3 text-sm hover:bg-[#01213f] transition-colors"
            >
              <Waves className="w-5 h-5 shrink-0" />
              <span>
                <strong>
                  {b.count} race{b.count === 1 ? "" : "s"}
                </strong>{" "}
                still need{b.count === 1 ? "s" : ""} a lineup for {b.eventTitle} ({b.eventDate})
              </span>
            </Link>
          ))}
        </div>
      )}

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

      {lineupBanners.length > 0 && (
        <div className="w-full max-w-md flex flex-col gap-2">
          {lineupBanners.map((b, i) => (
            <div key={i} className="bg-[#022e5d] text-white rounded-lg px-4 py-3 text-sm">
              🚣{" "}
              {b.rowerName ? (
                <>
                  <strong>{b.rowerName}</strong> is
                </>
              ) : (
                "You're"
              )}{" "}
              in the boat for <strong>{b.boatName}</strong>
              {b.raceName && (
                <>
                  {" "}(<strong>{b.raceName}</strong>)
                </>
              )}{" "}
              at {b.eventTitle} ({b.eventDate}
              {b.raceTimeLabel && <>, racing at <strong>{b.raceTimeLabel}</strong></>})
            </div>
          ))}
        </div>
      )}

      {(banners.length > 0 || (isParent && upcomingRegatta)) && (
        <div className="w-full max-w-md flex flex-col gap-2">
          {banners.map((b, i) => (
            <div
              key={i}
              className="bg-[#022e5d] text-white rounded-lg px-4 py-3 text-sm"
            >
              🍪 You&apos;re bringing{" "}
              <strong>
                {b.items.map((item, j) => (
                  <span key={j}>
                    {j > 0 && ", "}
                    {item.quantity}x {item.title}
                  </span>
                ))}
              </strong>{" "}
              to {b.eventTitle} ({b.eventDate})
            </div>
          ))}
          {isParent && (banners.length > 0 || upcomingRegatta) && (
            <div className="bg-[#022e5d] text-white rounded-lg px-4 py-3 text-sm">
              💧 Please also bring <strong>2 gallons of water</strong> (2 gal per family).
            </div>
          )}
        </div>
      )}

      <div className="w-full max-w-md grid grid-cols-3 gap-4">
        {NAV_SECTIONS.filter((s) => s.href !== "/coach/tracking" || isCoachOrAdmin)
          .filter((s) => {
            const visibility = navVisibilityByHref[s.href] ?? "everyone";
            if (isAdmin) return true; // admins always see every tile, off/admins-only ones greyed or noted below
            return visibility === "everyone";
          })
          .concat(isAdmin ? [{ href: "/todo", label: "To-do List" }, { href: "/admin", label: "Admin Settings" }] : [])
          .map((s) => {
            const Icon = ICONS_BY_HREF[s.href];
            const badgeCount =
              s.href === "/messages" ? unreadCount : s.href === "/schedule" ? unreadScheduleCount : 0;
            const visibility = navVisibilityByHref[s.href] ?? "everyone";

            if (visibility === "off") {
              return (
                <div
                  key={s.href}
                  title="Turned off for everyone — re-enable it in Admin Settings"
                  className="relative flex flex-col items-center justify-center gap-2 text-center rounded-lg border-2 border-gray-300 px-4 py-6 font-medium text-gray-400 grayscale opacity-50"
                >
                  <Icon className="w-6 h-6" />
                  {s.label}
                </div>
              );
            }

            return (
              <Link
                key={s.href}
                href={s.href}
                title={visibility === "admins" ? "Visible to admins only" : undefined}
                className="relative flex flex-col items-center justify-center gap-2 text-center rounded-lg border-2 border-[#022e5d] px-4 py-6 font-medium hover:bg-[#404040] hover:text-white transition-colors"
              >
                <Icon className="w-6 h-6" />
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
