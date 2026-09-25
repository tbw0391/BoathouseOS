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
  ClipboardList,
  Settings,
  Vote,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import RacingScull from "@/components/icons/RacingScull";
import { createClient } from "@/lib/supabase/server";
import type {
  AnnouncementAudience,
  ChatGroup,
  CoachAnnouncement,
  CoachTask,
  CoachTaskAssignment,
  EventForecast,
  FamilyLink,
  FoodTentItem,
  FoodTentSignup,
  FoodTentStatus,
  Lineup,
  LineupSeat,
  Profile,
  Race,
  ScheduleEvent,
  TaskType,
  VolunteerNeed,
} from "@/lib/database.types";
import { parseStoreItems } from "@/lib/storeItems";
import { getUnreadChatCount } from "@/lib/chat";
import { getUnreadScheduleCount } from "@/lib/schedule";
import { getOrRefreshEventForecast } from "@/lib/weather";
import { NAV_SECTIONS, resolveNavVisibility } from "@/lib/navSections";

const ICONS_BY_HREF: Record<string, LucideIcon> = {
  "/roster": Users,
  "/schedule": Calendar,
  "/lineups": Waves,
  "/boats": RacingScull,
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
  "/coach": ClipboardList,
  "/todo": ListTodo,
  "/admin": Settings,
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type FoodTentBanner = {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  items: { emoji: string; label: string }[];
};

type LineupBanner = {
  rowerName: string | null;
  boatName: string;
  raceName: string | null;
  raceTimeLabel: string | null;
  eventTitle: string;
  eventDate: string;
};

type CoachTaskBanner = {
  taskTypeName: string;
  boatName: string | null;
  raceName: string | null;
  eventTitle: string;
};

type PendingRaceBanner = { eventTitle: string; eventDate: string; count: number };

type AnnouncementBanner = { id: string; message: string; senderName: string; createdAt: string };

type FoodPrepBanner = { eventId: string; eventTitle: string; eventDate: string };

type SignupCallBanner = {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  hasVolunteerNeeds: boolean;
};

// Food tent items are free-text titles a coach/tent-leader types in, not a
// fixed category, so the emoji is guessed from keywords in the title —
// first match wins, falls back to a generic plate for anything unrecognized.
const FOOD_EMOJI_RULES: { keywords: string[]; emoji: string }[] = [
  { keywords: ["water"], emoji: "💧" },
  { keywords: ["gatorade", "sports drink", "powerade"], emoji: "🧃" },
  { keywords: ["juice"], emoji: "🧃" },
  { keywords: ["soda", "pop", "coke", "sprite"], emoji: "🥤" },
  { keywords: ["coffee"], emoji: "☕" },
  { keywords: ["donut", "doughnut"], emoji: "🍩" },
  { keywords: ["bagel"], emoji: "🥯" },
  { keywords: ["muffin", "cupcake"], emoji: "🧁" },
  { keywords: ["cookie"], emoji: "🍪" },
  { keywords: ["candy"], emoji: "🍬" },
  { keywords: ["popcorn"], emoji: "🍿" },
  { keywords: ["chip", "pretzel"], emoji: "🥨" },
  { keywords: ["ice cream", "popsicle"], emoji: "🍦" },
  { keywords: ["watermelon"], emoji: "🍉" },
  { keywords: ["orange", "clementine"], emoji: "🍊" },
  { keywords: ["banana"], emoji: "🍌" },
  { keywords: ["grape"], emoji: "🍇" },
  { keywords: ["apple"], emoji: "🍎" },
  { keywords: ["fruit"], emoji: "🍓" },
  { keywords: ["carrot", "veggie", "vegetable", "celery"], emoji: "🥕" },
  { keywords: ["cheese"], emoji: "🧀" },
  { keywords: ["pizza"], emoji: "🍕" },
  { keywords: ["hot dog"], emoji: "🌭" },
  { keywords: ["burger"], emoji: "🍔" },
  { keywords: ["taco"], emoji: "🌮" },
  { keywords: ["pasta", "noodle"], emoji: "🍝" },
  { keywords: ["sandwich", "sub", "wrap"], emoji: "🥪" },
  { keywords: ["bread", "bun", "roll"], emoji: "🍞" },
  { keywords: ["egg"], emoji: "🥚" },
  { keywords: ["napkin", "plate", "cup", "utensil", "fork", "spoon", "supplies"], emoji: "🧻" },
  { keywords: ["ice"], emoji: "🧊" },
];

function foodItemEmoji(title: string): string {
  const lower = title.toLowerCase();
  for (const rule of FOOD_EMOJI_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.emoji;
  }
  return "🍽️";
}

// Midnight of today, not the exact current instant — a "today's not over"
// event whose start time has already passed (e.g. a regatta in progress
// right now) should still count as relevant, not drop off these banners
// the moment its listed start time ticks by.
function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function loadFoodTentBanners(
  supabase: SupabaseServerClient,
  householdUserIds: string[]
): Promise<FoodTentBanner[]> {
  const { data: signupsData } = await supabase
    .from("food_tent_signups")
    .select("*")
    .in("user_id", householdUserIds);
  const signups = (signupsData as FoodTentSignup[] | null) ?? [];
  if (signups.length === 0) return [];

  const itemIds = signups.map((s) => s.item_id);
  const { data: itemsData } = await supabase.from("food_tent_items").select("*").in("id", itemIds);
  const items = (itemsData as FoodTentItem[] | null) ?? [];

  const eventIds = [...new Set(items.map((i) => i.event_id))];
  const { data: eventsData } = await supabase
    .from("schedule_events")
    .select("*")
    .in("id", eventIds)
    .gte("starts_at", startOfToday());
  const events = (eventsData as ScheduleEvent[] | null) ?? [];
  const eventById = new Map(events.map((e) => [e.id, e]));

  const bannersByEvent = new Map<string, FoodTentBanner>();
  for (const s of signups) {
    const item = items.find((i) => i.id === s.item_id);
    const event = item ? eventById.get(item.event_id) : undefined;
    if (!item || !event) continue;

    const existing = bannersByEvent.get(event.id);
    if (existing) {
      existing.items.push({ emoji: foodItemEmoji(item.title), label: `${s.quantity}x ${item.title}` });
    } else {
      bannersByEvent.set(event.id, {
        eventId: event.id,
        eventTitle: event.title,
        eventDate: new Date(event.starts_at).toLocaleDateString(),
        items: [{ emoji: foodItemEmoji(item.title), label: `${s.quantity}x ${item.title}` }],
      });
    }
  }

  return [...bannersByEvent.values()];
}

async function loadLineupBanners(
  supabase: SupabaseServerClient,
  opts: {
    userId: string;
    isRowerOrCoxswain: boolean;
    isParent: boolean;
    isCoachOrAdmin: boolean;
    householdUserIds: string[];
  }
): Promise<LineupBanner[]> {
  const { userId, isRowerOrCoxswain, isParent, isCoachOrAdmin, householdUserIds } = opts;

  // Whose lineup assignments this viewer should hear about: their own if
  // they're a rower/coxswain, or their linked rower/coxswain kid(s)' if
  // they're a parent (covering the whole household, not just whoever set
  // the family link).
  let lineupRowerIds: string[] = [];
  if (isRowerOrCoxswain) {
    lineupRowerIds = [userId];
  } else if (isParent || isCoachOrAdmin) {
    const { data: familyLinkRows } = await supabase
      .from("family_links")
      .select("rower_id")
      .in("guardian_id", householdUserIds);
    lineupRowerIds = [
      ...new Set(((familyLinkRows as Pick<FamilyLink, "rower_id">[] | null) ?? []).map((l) => l.rower_id)),
    ];
  }
  if (lineupRowerIds.length === 0) return [];

  const { data: seatRows } = await supabase.from("lineup_seats").select("*").in("rower_id", lineupRowerIds);
  const seats = (seatRows as LineupSeat[] | null) ?? [];
  if (seats.length === 0) return [];

  const lineupIds = [...new Set(seats.map((s) => s.lineup_id))];
  const { data: lineupRows } = await supabase.from("lineups").select("*").in("id", lineupIds);
  const lineupsData = (lineupRows as Lineup[] | null) ?? [];
  const lineupById = new Map(lineupsData.map((l) => [l.id, l]));

  const eventIds = [...new Set(lineupsData.map((l) => l.event_id).filter((id): id is string => !!id))];

  const [{ data: eventRows }, rowerNameRows] = await Promise.all([
    supabase
      .from("schedule_events")
      .select("*")
      .in("id", eventIds)
      .gte("starts_at", startOfToday()),
    isParent || isCoachOrAdmin
      ? supabase.from("profiles").select("id, display_name").in("id", lineupRowerIds)
      : Promise.resolve({ data: null }),
  ]);
  const eventsData = (eventRows as ScheduleEvent[] | null) ?? [];
  const eventById = new Map(eventsData.map((e) => [e.id, e]));

  const rowerNameById = new Map<string, string>();
  for (const p of (rowerNameRows.data as Pick<Profile, "id" | "display_name">[] | null) ?? []) {
    rowerNameById.set(p.id, p.display_name);
  }

  return seats
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
          ? new Date(lineup.race_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
          : null,
        eventTitle: event.title,
        eventDate: new Date(event.starts_at).toLocaleDateString(),
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);
}

// Coach/admin notification: races that have been collected (e.g. via a heat
// sheet import) but don't have a boat/crew assigned yet.
async function loadPendingRaceBanners(supabase: SupabaseServerClient): Promise<PendingRaceBanner[]> {
  const { data: pendingRaceRows } = await supabase.from("races").select("*").is("lineup_id", null);
  const pendingRacesData = (pendingRaceRows as Race[] | null) ?? [];
  if (pendingRacesData.length === 0) return [];

  const eventIds = [...new Set(pendingRacesData.map((r) => r.event_id))];
  const { data: eventRows } = await supabase
    .from("schedule_events")
    .select("*")
    .in("id", eventIds)
    .gte("starts_at", startOfToday());
  const eventsData = (eventRows as ScheduleEvent[] | null) ?? [];

  return eventsData
    .map((event) => ({
      eventTitle: event.title,
      eventDate: new Date(event.starts_at).toLocaleDateString(),
      count: pendingRacesData.filter((r) => r.event_id === event.id).length,
    }))
    .filter((b) => b.count > 0);
}

// Tent-leader/manager notification: the 7-days-out cron (see
// 0048_regatta_prep_cron.sql) auto-filled a draft food list from the last
// regatta and is waiting on someone to review/edit it, then publish.
async function loadFoodPrepBanners(supabase: SupabaseServerClient): Promise<FoodPrepBanner[]> {
  const { data: statusRows } = await supabase
    .from("food_tent_status")
    .select("*")
    .eq("status", "pending_confirmation");
  const pending = (statusRows as FoodTentStatus[] | null) ?? [];
  if (pending.length === 0) return [];

  const eventIds = pending.map((s) => s.event_id);
  const { data: eventRows } = await supabase.from("schedule_events").select("*").in("id", eventIds);
  const events = (eventRows as ScheduleEvent[] | null) ?? [];

  return events.map((event) => ({
    eventId: event.id,
    eventTitle: event.title,
    eventDate: new Date(event.starts_at).toLocaleDateString(),
  }));
}

// Parent/guardian notification: the food list has been published, so it's
// time to sign up for food items and (if any are posted) volunteer slots.
async function loadSignupCallBanners(
  supabase: SupabaseServerClient,
  householdUserIds: string[]
): Promise<SignupCallBanner[]> {
  const { data: statusRows } = await supabase
    .from("food_tent_status")
    .select("*")
    .eq("status", "published");
  const published = (statusRows as FoodTentStatus[] | null) ?? [];
  if (published.length === 0) return [];

  const eventIds = published.map((s) => s.event_id);
  const [{ data: eventRows }, { data: needRows }, { data: itemRows }] = await Promise.all([
    supabase.from("schedule_events").select("*").in("id", eventIds).gte("starts_at", startOfToday()),
    supabase.from("volunteer_needs").select("id, event_id").in("event_id", eventIds),
    supabase.from("food_tent_items").select("id, event_id").in("event_id", eventIds),
  ]);
  const events = (eventRows as ScheduleEvent[] | null) ?? [];
  const needs = (needRows as Pick<VolunteerNeed, "id" | "event_id">[] | null) ?? [];
  const items = (itemRows as Pick<FoodTentItem, "id" | "event_id">[] | null) ?? [];
  const eventIdsWithNeeds = new Set(needs.map((n) => n.event_id).filter((id): id is string => !!id));

  // A household that's already signed up for a food item OR claimed a
  // volunteer slot for an event has done what this banner is asking —
  // stop nagging them about it, even if their crewmates haven't.
  const [{ data: foodSignupRows }, { data: volunteerSignupRows }] = await Promise.all([
    items.length > 0
      ? supabase
          .from("food_tent_signups")
          .select("item_id")
          .in("user_id", householdUserIds)
          .in(
            "item_id",
            items.map((i) => i.id)
          )
      : Promise.resolve({ data: [] }),
    needs.length > 0
      ? supabase
          .from("volunteer_signups")
          .select("need_id")
          .in("user_id", householdUserIds)
          .in(
            "need_id",
            needs.map((n) => n.id)
          )
      : Promise.resolve({ data: [] }),
  ]);
  const itemEventById = new Map(items.map((i) => [i.id, i.event_id]));
  const needEventById = new Map(needs.map((n) => [n.id, n.event_id]));
  const alreadyActedEventIds = new Set([
    ...(((foodSignupRows as { item_id: string }[] | null) ?? [])
      .map((s) => itemEventById.get(s.item_id))
      .filter((id): id is string => !!id)),
    ...(((volunteerSignupRows as { need_id: string }[] | null) ?? [])
      .map((s) => needEventById.get(s.need_id))
      .filter((id): id is string => !!id)),
  ]);

  return events
    .filter((event) => !alreadyActedEventIds.has(event.id))
    .map((event) => ({
      eventId: event.id,
      eventTitle: event.title,
      eventDate: new Date(event.starts_at).toLocaleDateString(),
      hasVolunteerNeeds: eventIdsWithNeeds.has(event.id),
    }));
}

// Coach Tasks (e.g. Launch/Recovery) assignment: shown only to the rower/
// coxswain themselves, not their parent — unlike the lineup banner, this is
// just "which boat am I on the hook for," not something a parent needs to
// track on their behalf.
async function loadCoachTaskBanners(
  supabase: SupabaseServerClient,
  opts: { userId: string; isRowerOrCoxswain: boolean }
): Promise<CoachTaskBanner[]> {
  const { userId, isRowerOrCoxswain } = opts;
  if (!isRowerOrCoxswain) return [];

  const { data: assignmentRows } = await supabase
    .from("coach_task_assignments")
    .select("*")
    .eq("user_id", userId);
  const assignments = (assignmentRows as CoachTaskAssignment[] | null) ?? [];
  if (assignments.length === 0) return [];

  const taskIds = [...new Set(assignments.map((a) => a.task_id))];
  const { data: taskRows } = await supabase.from("coach_tasks").select("*").in("id", taskIds);
  const tasks = (taskRows as CoachTask[] | null) ?? [];

  const eventIds = [...new Set(tasks.map((t) => t.event_id))];
  const lineupIds = [...new Set(tasks.map((t) => t.lineup_id).filter((id): id is string => !!id))];
  const raceIds = [...new Set(tasks.map((t) => t.race_id).filter((id): id is string => !!id))];
  const taskTypeIds = [...new Set(tasks.map((t) => t.task_type_id))];

  const [{ data: eventRows }, { data: lineupRows }, { data: raceRows }, { data: taskTypeRows }] = await Promise.all([
    supabase
      .from("schedule_events")
      .select("*")
      .in("id", eventIds)
      .gte("starts_at", startOfToday()),
    lineupIds.length
      ? supabase.from("lineups").select("id, boat_name, race_name").in("id", lineupIds)
      : Promise.resolve({ data: [] as Pick<Lineup, "id" | "boat_name" | "race_name">[] }),
    // A task auto-created straight off a race import (see importRaces)
    // doesn't have a boat yet — fall back to the race's own name.
    raceIds.length
      ? supabase.from("races").select("id, race_name").in("id", raceIds)
      : Promise.resolve({ data: [] as Pick<Race, "id" | "race_name">[] }),
    supabase.from("task_types").select("*").in("id", taskTypeIds),
  ]);
  const eventById = new Map(((eventRows as ScheduleEvent[] | null) ?? []).map((e) => [e.id, e]));
  const lineupById = new Map(
    ((lineupRows as Pick<Lineup, "id" | "boat_name" | "race_name">[] | null) ?? []).map((l) => [l.id, l])
  );
  const raceNameByRaceId = new Map(
    ((raceRows as Pick<Race, "id" | "race_name">[] | null) ?? []).map((r) => [r.id, r.race_name])
  );
  const taskTypeNameById = new Map(((taskTypeRows as TaskType[] | null) ?? []).map((t) => [t.id, t.name]));

  return tasks
    .filter((task) => assignments.some((a) => a.task_id === task.id))
    .map((task) => {
      const event = eventById.get(task.event_id);
      if (!event) return null;
      const lineup = task.lineup_id ? lineupById.get(task.lineup_id) : undefined;
      return {
        taskTypeName: taskTypeNameById.get(task.task_type_id) ?? "a task",
        boatName: lineup?.boat_name ?? null,
        raceName: lineup?.race_name ?? (task.race_id ? raceNameByRaceId.get(task.race_id) ?? null : null),
        eventTitle: event.title,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);
}

// Coach/admin-sent broadcasts, shown as a home banner only to their intended
// audience (rowers/coxswains or parents) — coaches see these on the
// /announcements page instead, not as a banner on their own home page.
async function loadAnnouncementBanners(
  supabase: SupabaseServerClient,
  audience: AnnouncementAudience[]
): Promise<AnnouncementBanner[]> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("coach_announcements")
    .select("*")
    .in("audience", audience)
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false });
  const announcements = (data as CoachAnnouncement[] | null) ?? [];
  if (announcements.length === 0) return [];

  const senderIds = [...new Set(announcements.map((a) => a.sender_id).filter((id): id is string => !!id))];
  const { data: sendersData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", senderIds.length > 0 ? senderIds : [""]);
  const nameById = new Map(
    ((sendersData as Pick<Profile, "id" | "display_name">[] | null) ?? []).map((p) => [p.id, p.display_name])
  );

  return announcements.map((a) => ({
    id: a.id,
    message: a.message,
    senderName: a.sender_id ? nameById.get(a.sender_id) ?? "Coach" : "Coach",
    createdAt: new Date(a.created_at).toLocaleDateString(),
  }));
}

export default async function Home() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: settingsData },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("club_settings")
      .select("key, value")
      .in("key", ["team_store_url", "team_store_featured_items", "nav_visibility", "nav_disabled_hrefs"]),
  ]);
  const settingsByKey = new Map(
    ((settingsData as { key: string; value: string | null }[] | null) ?? []).map((s) => [s.key, s.value])
  );
  const storeUrl = settingsByKey.get("team_store_url") ?? null;
  const featuredItems = parseStoreItems(settingsByKey.get("team_store_featured_items") ?? null);
  const navVisibilityByHref = resolveNavVisibility(settingsByKey);

  let banners: FoodTentBanner[] = [];
  let lineupBanners: LineupBanner[] = [];
  let coachTaskBanners: CoachTaskBanner[] = [];
  let pendingRaceBanners: PendingRaceBanner[] = [];
  let foodPrepBanners: FoodPrepBanner[] = [];
  let signupCallBanners: SignupCallBanner[] = [];
  let announcementBanners: AnnouncementBanner[] = [];
  let upcomingRegatta: ScheduleEvent | null = null;
  let upcomingRegattaForecast: EventForecast | null = null;
  let unreadCount = 0;
  let unreadScheduleCount = 0;
  let coachChatHref = "/messages";
  let isAdmin = false;
  let isCoachOrAdmin = false;
  let isParent = false;
  let isRowerOrCoxswain = false;
  let isFoodTentManager = false;
  let firstName: string | null = null;

  let householdUserIds: string[] = [];

  if (user) {
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // These five only need the user's id, not each other's results, so run
    // them concurrently instead of one round trip at a time.
    const [
      unreadCountResult,
      unreadScheduleCountResult,
      callerResult,
      coachGroupResult,
      regattaResult,
    ] = await Promise.all([
      getUnreadChatCount(user.id),
      getUnreadScheduleCount(user.id),
      supabase.from("profiles").select("role, spouse_id, is_tent_leader, first_name").eq("id", user.id).single(),
      supabase.from("chat_groups").select("id").eq("team", "coach").maybeSingle(),
      supabase
        .from("schedule_events")
        .select("*")
        .eq("event_type", "regatta")
        .gte("starts_at", startOfToday())
        .lte("starts_at", weekOut.toISOString())
        .order("starts_at", { ascending: true })
        .limit(1),
    ]);

    unreadCount = unreadCountResult;
    unreadScheduleCount = unreadScheduleCountResult;

    const caller = callerResult.data as Pick<Profile, "role" | "spouse_id" | "is_tent_leader" | "first_name"> | null;
    const callerRole = caller?.role;
    isAdmin = callerRole === "admin";
    isCoachOrAdmin = callerRole === "admin" || callerRole === "coach";
    isParent = callerRole === "parent";
    isRowerOrCoxswain = callerRole === "rower" || callerRole === "coxswain";
    isFoodTentManager = isCoachOrAdmin || Boolean(caller?.is_tent_leader);
    firstName = caller?.first_name ?? null;

    if ((coachGroupResult.data as Pick<ChatGroup, "id"> | null)?.id) {
      coachChatHref = `/messages/${(coachGroupResult.data as Pick<ChatGroup, "id">).id}`;
    }

    upcomingRegatta = ((regattaResult.data as ScheduleEvent[] | null) ?? [])[0] ?? null;

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
  }

  if (user) {
    // These are independent of each other, so load them concurrently.
    // "Family" for the water reminder below means guardian-of-a-rower, not
    // the literal profile.role value — a coach/admin who's also linked to a
    // rower as a guardian counts too, same as the lineup banner already does.
    const [
      foodBanners,
      lineupBannerResults,
      coachTaskBannerResults,
      pendingRaceBannerResults,
      familyLinkRows,
      foodPrepBannerResults,
      signupCallBannerResults,
      forecastResult,
      announcementBannerResults,
    ] = await Promise.all([
      loadFoodTentBanners(supabase, householdUserIds),
      loadLineupBanners(supabase, {
        userId: user.id,
        isRowerOrCoxswain,
        isParent,
        isCoachOrAdmin,
        householdUserIds,
      }),
      loadCoachTaskBanners(supabase, { userId: user.id, isRowerOrCoxswain }),
      isCoachOrAdmin ? loadPendingRaceBanners(supabase) : Promise.resolve([]),
      supabase.from("family_links").select("rower_id").in("guardian_id", householdUserIds),
      isFoodTentManager ? loadFoodPrepBanners(supabase) : Promise.resolve([]),
      loadSignupCallBanners(supabase, householdUserIds),
      upcomingRegatta ? getOrRefreshEventForecast(supabase, upcomingRegatta) : Promise.resolve(null),
      isRowerOrCoxswain
        ? loadAnnouncementBanners(supabase, ["rowers", "both"])
        : isParent
        ? loadAnnouncementBanners(supabase, ["parents", "both"])
        : Promise.resolve([]),
    ]);
    banners = foodBanners;
    upcomingRegattaForecast = forecastResult;
    lineupBanners = lineupBannerResults;
    coachTaskBanners = coachTaskBannerResults;
    pendingRaceBanners = pendingRaceBannerResults;
    foodPrepBanners = foodPrepBannerResults;
    announcementBanners = announcementBannerResults;
    const isGuardian = (familyLinkRows.data ?? []).length > 0;
    signupCallBanners = isParent || isGuardian ? signupCallBannerResults : [];

    // Every family is asked to bring 2 gal of water per regatta, regardless
    // of what else they signed up for — fold it in as its own line on each
    // food tent banner, and give parents a water-only banner for an
    // upcoming regatta even if they haven't signed up for any items yet.
    if (isParent || isGuardian) {
      banners = banners.map((b) => ({
        ...b,
        items: [...b.items, { emoji: "💧", label: "2 gal of water" }],
      }));
      if (upcomingRegatta && !banners.some((b) => b.eventId === upcomingRegatta!.id)) {
        banners.push({
          eventId: upcomingRegatta.id,
          eventTitle: upcomingRegatta.title,
          eventDate: new Date(upcomingRegatta.starts_at).toLocaleDateString(),
          items: [{ emoji: "💧", label: "2 gal of water" }],
        });
      }
    }
  }

  return (
    <div className="min-h-screen p-8 flex flex-col items-center gap-8">
      {firstName && (
        <div className="w-full text-left font-medium text-gray-700">
          Welcome, {firstName}
        </div>
      )}
      <div className="text-center">
        <Image
          src="/branding/logo-full.png"
          alt="Club logo"
          width={480}
          height={530}
          priority
          className="w-40 h-auto mx-auto"
        />
      </div>

      {announcementBanners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {announcementBanners.map((b) => (
            <Link
              key={b.id}
              href="/announcements"
              className="flex items-start gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-accent)] transition-colors"
            >
              <Megaphone className="w-5 h-5 shrink-0 mt-0.5" />
              <span>
                <strong>{b.senderName}</strong> ({b.createdAt}): {b.message}
              </span>
            </Link>
          ))}
        </div>
      )}

      {pendingRaceBanners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {pendingRaceBanners.map((b, i) => (
            <Link
              key={i}
              href="/lineups"
              className="flex items-center gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-accent)] transition-colors"
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

      {foodPrepBanners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {foodPrepBanners.map((b, i) => (
            <Link
              key={i}
              href="/food-tent"
              className="flex items-center gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-accent)] transition-colors"
            >
              <Tent className="w-5 h-5 shrink-0" />
              <span>
                The food list for <strong>{b.eventTitle}</strong> ({b.eventDate}) was auto-filled
                from the last regatta — review, edit if needed, and publish it.
              </span>
            </Link>
          ))}
        </div>
      )}

      {signupCallBanners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {signupCallBanners.map((b, i) => (
            <div key={i} className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm flex flex-col gap-2">
              <p>
                📋 Signups are open for <strong>{b.eventTitle}</strong> ({b.eventDate}) — pick a food
                tent item{b.hasVolunteerNeeds ? " and a volunteer slot" : ""}.
              </p>
              <div className="flex gap-2">
                <Link
                  href="/food-tent"
                  className="text-xs bg-white text-[var(--color-primary)] rounded px-2 py-1 font-medium"
                >
                  Food Tent
                </Link>
                {b.hasVolunteerNeeds && (
                  <Link
                    href="/volunteer"
                    className="text-xs bg-white text-[var(--color-primary)] rounded px-2 py-1 font-medium"
                  >
                    Volunteer Needs
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {upcomingRegatta && upcomingRegattaForecast?.short_forecast && (
        <div className="w-full flex items-center gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm">
          {upcomingRegattaForecast.icon_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={upcomingRegattaForecast.icon_url} alt="" className="w-10 h-10 shrink-0" />
          )}
          <span>
            Forecast for <strong>{upcomingRegatta.title}</strong> (
            {new Date(upcomingRegatta.starts_at).toLocaleDateString()}):{" "}
            <strong>{upcomingRegattaForecast.short_forecast}</strong>
            {upcomingRegattaForecast.high_f !== null && <>, high {upcomingRegattaForecast.high_f}°F</>}
            {upcomingRegattaForecast.low_f !== null && <>, low {upcomingRegattaForecast.low_f}°F</>}
            {upcomingRegattaForecast.precipitation_chance !== null &&
              upcomingRegattaForecast.precipitation_chance > 0 && (
                <>, {upcomingRegattaForecast.precipitation_chance}% chance of rain</>
              )}
            {upcomingRegattaForecast.wind && <>, wind {upcomingRegattaForecast.wind}</>}
          </span>
        </div>
      )}

      {upcomingRegatta && (
        <div className="w-full flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">
            {upcomingRegatta.title} is coming up on{" "}
            {new Date(upcomingRegatta.starts_at).toLocaleDateString()} — get ready:
          </p>
          <Link
            href="/food-tent"
            className="flex items-center gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-accent)] transition-colors"
          >
            <Tent className="w-5 h-5 shrink-0" />
            Sign up for the food tent
          </Link>
          <Link
            href="/volunteer"
            className="flex items-center gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-accent)] transition-colors"
          >
            <HelpingHand className="w-5 h-5 shrink-0" />
            Sign up for a volunteer slot
          </Link>
          <Link
            href="/lineups"
            className="flex items-center gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-accent)] transition-colors"
          >
            <Waves className="w-5 h-5 shrink-0" />
            Check the lineups
          </Link>
          <Link
            href={coachChatHref}
            className="flex items-center gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-accent)] transition-colors"
          >
            <MessageCircle className="w-5 h-5 shrink-0" />
            Read coaches&apos; messages
          </Link>
        </div>
      )}

      {lineupBanners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {lineupBanners.map((b, i) => (
            <div key={i} className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm">
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

      {coachTaskBanners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {coachTaskBanners.map((b, i) => (
            <div key={i} className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm">
              📋 You&apos;re on <strong>{b.taskTypeName}</strong>
              {b.boatName && (
                <>
                  {" "}for <strong>{b.boatName}</strong>
                </>
              )}{" "}
              at {b.eventTitle}
              {b.raceName && (
                <>
                  {" "}(<strong>{b.raceName}</strong>)
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {banners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {banners.map((b, i) => (
            <div
              key={i}
              className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm"
            >
              <p>
                You&apos;re bringing to <strong>{b.eventTitle}</strong> ({b.eventDate}):
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {b.items.map((item, j) => (
                  <li key={j}>
                    {item.emoji} {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="w-full grid grid-cols-3 gap-4">
        {NAV_SECTIONS.filter((s) => s.href !== "/coach" || isCoachOrAdmin)
          .filter((s) => {
            const visibility = navVisibilityByHref[s.href] ?? "everyone";
            if (isAdmin) return true; // admins always see every tile, off/admins-only ones greyed or noted below
            if (visibility === "coaches") return isCoachOrAdmin;
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
                title={
                  visibility === "admins"
                    ? "Visible to admins only"
                    : visibility === "coaches"
                      ? "Visible to coaches and admins only"
                      : undefined
                }
                className="relative flex flex-col items-center justify-center gap-2 text-center rounded-lg border-2 border-[var(--color-primary)] px-4 py-6 font-medium hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
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
        <div className="w-full max-w-md rounded-xl border-2 border-[var(--color-primary)] overflow-hidden">
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-[var(--color-primary)] text-white px-5 py-4 hover:bg-[var(--color-accent)] transition-colors"
          >
            <ShoppingBag className="w-7 h-7 shrink-0" />
            <div>
              <p className="text-lg font-bold leading-tight">Team Store</p>
              <p className="text-sm text-white/80">Shop official club gear →</p>
            </div>
          </a>
          {featuredItems.length > 0 && (
            <div className="grid grid-cols-2 gap-px bg-[var(--color-primary)]/20">
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
