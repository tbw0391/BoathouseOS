import Link from "next/link";
import { cookies } from "next/headers";
import { captainSeat, oarSheetComplete } from "@/lib/oarSheet";
import { regattaPrepSeen } from "@/lib/regattaPrep";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SignupCallLink } from "@/components/SignupCallLink";
import { SIGNUP_CALL_SEEN_COOKIE, parseSignupCallSeen } from "@/lib/signupCallSeen";
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
  ShieldCheck,
  Trophy,
  CreditCard,
  Shirt,
  Sprout,
  CloudLightning,
  type LucideIcon,
} from "lucide-react";
import RacingScull from "@/components/icons/RacingScull";
import StarterFlag from "@/components/icons/StarterFlag";
import { PushToggle } from "@/components/PushToggle";
import { EmailAlertsToggle } from "@/components/EmailAlertsToggle";
import { RegattaWeekPopup, type RegattaWeekLink } from "@/components/RegattaWeekPopup";
import { ALERT_SETTINGS_KEY, parseAlertSettings } from "@/lib/alertSettings";
import { DEMO_PROFILES, isDemoEmail } from "@/lib/demoAccount";
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
  PracticeAttendance,
  Profile,
  Race,
  ScheduleEvent,
  TaskType,
  VolunteerNeed,
} from "@/lib/database.types";
import { parseStoreItems } from "@/lib/storeItems";
import { getUnreadChatCount } from "@/lib/chat";
import {
  formatErgSeconds,
  loadBirthdaysToday,
  loadMyRecentPrs,
  type BirthdayPerson,
  type PrBanner,
} from "@/lib/celebrations";
import { getUnreadScheduleCount } from "@/lib/schedule";
import { forecastDayFor, getOrRefreshEventForecast } from "@/lib/weather";
import { NAV_ACCESS_KEY, NAV_SECTIONS, resolveNavAccess, type NavRole } from "@/lib/navSections";
import { QrCodes } from "@/app/global-admin/qr/QrCodes";
import { IS_DEMO_SITE } from "@/lib/site";
import {
  DEMO_CLUB_COOKIE,
  findDemoClub,
  getSelectedClubSlug,
  visibleToClub,
} from "@/lib/demoClubs";
import { HOTC, getHotcSchedule } from "@/lib/hotc";
import { syncHotcResults } from "@/lib/hotcResults";
import { placeEmoji, ordinalPlace } from "@/lib/raceResults";
import { clubDateKey, clubTimeLabel, delayedRaceTime, pickRaceDayEvent, raceIsOver } from "@/lib/raceDay";
import { PRACTICE_CALL_LABELS, lightningMinutesLeft } from "@/lib/waterConditions";
import { formatMoney } from "@/lib/payments";
import { getTodaysCheckInLabel } from "@/lib/checkIns";
import { CheckInButton } from "@/components/CheckInButton";
import { PracticeCheckIn } from "@/components/PracticeCheckIn";
import {
  ABSENCE_REASONS,
  formatAttendanceTime,
  getMyAttendanceToday,
} from "@/lib/practiceAttendance";

const ICONS_BY_HREF: Record<string, LucideIcon> = {
  "/roster": Users,
  "/schedule": Calendar,
  "/race-day": StarterFlag,
  "/lineups": Waves,
  "/boats": RacingScull,
  "/on-water": Navigation,
  "/water": CloudLightning,
  "/workouts": Dumbbell,
  "/food-tent": Tent,
  "/rookie-parent": Sprout,
  "/payments": CreditCard,
  "/apparel": Shirt,
  "/apparel/manage": Shirt,
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
  "/global-admin": ShieldCheck,
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

// A coach/admin's view of the lineup banner their rowers now see: one per
// lineup they created, with who it went to.
type SentLineupNotice = Omit<LineupBanner, "rowerName"> & {
  lineupId: string;
  recipientNames: string[];
};

type CoachTaskBanner = {
  taskTypeName: string;
  boatName: string | null;
  raceName: string | null;
  eventTitle: string;
};

type OarSheetBanner = {
  lineupId: string;
  boatName: string;
  raceName: string | null;
  eventTitle: string;
};

type RacingBanner = {
  lineupId: string;
  boatName: string;
  raceName: string | null;
  finished: boolean;
  place: number | null;
};

type PendingRaceBanner = {
  eventTitle: string;
  eventDate: string;
  count: number;
};

type AnnouncementBanner = {
  id: string;
  message: string;
  senderName: string;
  createdAt: string;
};

type FoodPrepBanner = {
  eventId: string;
  eventTitle: string;
  eventDate: string;
};

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
  {
    keywords: [
      "napkin",
      "plate",
      "cup",
      "utensil",
      "fork",
      "spoon",
      "supplies",
    ],
    emoji: "🧻",
  },
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
  householdUserIds: string[],
): Promise<FoodTentBanner[]> {
  const { data: signupsData } = await supabase
    .from("food_tent_signups")
    .select("*")
    .in("user_id", householdUserIds);
  const signups = (signupsData as FoodTentSignup[] | null) ?? [];
  if (signups.length === 0) return [];

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
      existing.items.push({
        emoji: foodItemEmoji(item.title),
        label: `${s.quantity}x ${item.title}`,
      });
    } else {
      bannersByEvent.set(event.id, {
        eventId: event.id,
        eventTitle: event.title,
        eventDate: new Date(event.starts_at).toLocaleDateString(),
        items: [
          {
            emoji: foodItemEmoji(item.title),
            label: `${s.quantity}x ${item.title}`,
          },
        ],
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
  },
): Promise<LineupBanner[]> {
  const {
    userId,
    isRowerOrCoxswain,
    isParent,
    isCoachOrAdmin,
    householdUserIds,
  } = opts;

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
      ...new Set(
        ((familyLinkRows as Pick<FamilyLink, "rower_id">[] | null) ?? []).map(
          (l) => l.rower_id,
        ),
      ),
    ];
  }
  if (lineupRowerIds.length === 0) return [];

  // Their seats in boats for events from today on, with each boat and event
  // (one round trip; past seasons' seats never leave the database).
  const [{ data: seatRows }, rowerNameRows] = await Promise.all([
    supabase
      .from("lineup_seats")
      .select("*, lineups!inner(*, schedule_events!inner(*))")
      .in("rower_id", lineupRowerIds)
      .gte("lineups.schedule_events.starts_at", startOfToday()),
    isParent || isCoachOrAdmin
      ? supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", lineupRowerIds)
      : Promise.resolve({ data: null }),
  ]);
  const joined =
    (seatRows as unknown as (LineupSeat & {
      lineups: Lineup & { schedule_events: ScheduleEvent };
    })[] | null) ?? [];
  if (joined.length === 0) return [];
  const seats: LineupSeat[] = joined.map((j) => ({
    id: j.id,
    lineup_id: j.lineup_id,
    seat_number: j.seat_number,
    seat_role: j.seat_role,
    rower_id: j.rower_id,
  }));
  const lineupById = new Map(joined.map((j) => [j.lineups.id, j.lineups as Lineup]));
  const eventById = new Map(joined.map((j) => [j.lineups.schedule_events.id, j.lineups.schedule_events]));

  const rowerNameById = new Map<string, string>();
  for (const p of (rowerNameRows.data as
    Pick<Profile, "id" | "display_name">[] | null) ?? []) {
    rowerNameById.set(p.id, p.display_name);
  }

  return seats
    .map((seat) => {
      if (!seat.rower_id) return null;
      const lineup = lineupById.get(seat.lineup_id);
      const event = lineup?.event_id
        ? eventById.get(lineup.event_id)
        : undefined;
      if (!lineup || !event) return null;
      // Race's done: a result's in, or it's 2 hours past the race time
      // plus any running-late delay (regattas run late, so not right at the
      // start time).
      const delayMinutes = event.race_delay_minutes ?? 0;
      if (raceIsOver(lineup, new Date(), delayMinutes)) return null;
      return {
        rowerName:
          isParent || isCoachOrAdmin
            ? (rowerNameById.get(seat.rower_id) ?? "Someone")
            : null,
        boatName: lineup.boat_name,
        raceName: lineup.race_name,
        raceTimeLabel: lineup.race_time
          ? clubTimeLabel(delayedRaceTime(lineup.race_time, delayMinutes)) +
            (delayMinutes ? ` (${delayMinutes} min late)` : "")
          : null,
        eventTitle: event.title,
        eventDate: new Date(event.starts_at).toLocaleDateString(),
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);
}

// Coach/admin: the lineups they created for upcoming events, with the rowers
// seated in each — so they can see the notification those rowers got
// without signing in as one of them.
async function loadSentLineupNotices(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<SentLineupNotice[]> {
  const { data: lineupRows } = await supabase
    .from("lineups")
    .select("*")
    .eq("created_by", userId)
    .not("event_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  const lineupsData = (lineupRows as Lineup[] | null) ?? [];
  if (lineupsData.length === 0) return [];

  const eventIds = [...new Set(lineupsData.map((l) => l.event_id as string))];
  const [{ data: eventRows }, { data: seatRows }] = await Promise.all([
    supabase
      .from("schedule_events")
      .select("*")
      .in("id", eventIds)
      .gte("starts_at", startOfToday()),
    supabase
      .from("lineup_seats")
      .select("*")
      .in(
        "lineup_id",
        lineupsData.map((l) => l.id),
      )
      .not("rower_id", "is", null),
  ]);
  const eventById = new Map(
    ((eventRows as ScheduleEvent[] | null) ?? []).map((e) => [e.id, e]),
  );
  const seats = ((seatRows as LineupSeat[] | null) ?? []).sort(
    (a, b) => a.seat_number - b.seat_number,
  );
  if (seats.length === 0) return [];

  const { data: nameRows } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", [...new Set(seats.map((s) => s.rower_id as string))]);
  const nameById = new Map(
    ((nameRows as Pick<Profile, "id" | "display_name">[] | null) ?? []).map(
      (p) => [p.id, p.display_name],
    ),
  );

  return lineupsData
    .map((lineup) => {
      const event = eventById.get(lineup.event_id as string);
      const recipientNames = seats
        .filter((s) => s.lineup_id === lineup.id)
        .map((s) => nameById.get(s.rower_id as string) ?? "Someone");
      if (!event || recipientNames.length === 0) return null;
      return {
        lineupId: lineup.id,
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
        recipientNames,
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null)
    .slice(0, 5);
}

// Coach/admin notification: races that have been collected (e.g. via a heat
// sheet import) but don't have a boat/crew assigned yet.
async function loadPendingRaceBanners(
  supabase: SupabaseServerClient,
): Promise<PendingRaceBanner[]> {
  const { data: pendingRaceRows } = await supabase
    .from("races")
    .select("*")
    .is("lineup_id", null);
  const selectedClubSlug = await getSelectedClubSlug();
  const pendingRacesData = ((pendingRaceRows as Race[] | null) ?? []).filter(
    (r) => visibleToClub(r.club_slug, selectedClubSlug),
  );
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
async function loadFoodPrepBanners(
  supabase: SupabaseServerClient,
): Promise<FoodPrepBanner[]> {
  const { data: statusRows } = await supabase
    .from("food_tent_status")
    .select("*")
    .eq("status", "pending_confirmation");
  const pending = (statusRows as FoodTentStatus[] | null) ?? [];
  if (pending.length === 0) return [];

  const eventIds = pending.map((s) => s.event_id);
  const { data: eventRows } = await supabase
    .from("schedule_events")
    .select("*")
    .in("id", eventIds);
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
  householdUserIds: string[],
): Promise<SignupCallBanner[]> {
  const { data: statusRows } = await supabase
    .from("food_tent_status")
    .select("*")
    .eq("status", "published");
  const published = (statusRows as FoodTentStatus[] | null) ?? [];
  if (published.length === 0) return [];

  const eventIds = published.map((s) => s.event_id);
  const [{ data: eventRows }, { data: needRows }, { data: itemRows }] =
    await Promise.all([
      supabase
        .from("schedule_events")
        .select("*")
        .in("id", eventIds)
        .gte("starts_at", startOfToday()),
      supabase
        .from("volunteer_needs")
        .select("id, event_id")
        .in("event_id", eventIds),
      supabase
        .from("food_tent_items")
        .select("id, event_id")
        .in("event_id", eventIds),
    ]);
  const events = (eventRows as ScheduleEvent[] | null) ?? [];
  const needs =
    (needRows as Pick<VolunteerNeed, "id" | "event_id">[] | null) ?? [];
  const items =
    (itemRows as Pick<FoodTentItem, "id" | "event_id">[] | null) ?? [];
  const eventIdsWithNeeds = new Set(
    needs.map((n) => n.event_id).filter((id): id is string => !!id),
  );

  // A household that's already signed up for a food item OR claimed a
  // volunteer slot for an event has done what this banner is asking —
  // stop nagging them about it, even if their crewmates haven't.
  const [{ data: foodSignupRows }, { data: volunteerSignupRows }] =
    await Promise.all([
      items.length > 0
        ? supabase
            .from("food_tent_signups")
            .select("item_id")
            .in("user_id", householdUserIds)
            .in(
              "item_id",
              items.map((i) => i.id),
            )
        : Promise.resolve({ data: [] }),
      needs.length > 0
        ? supabase
            .from("volunteer_signups")
            .select("need_id")
            .in("user_id", householdUserIds)
            .in(
              "need_id",
              needs.map((n) => n.id),
            )
        : Promise.resolve({ data: [] }),
    ]);
  const itemEventById = new Map(items.map((i) => [i.id, i.event_id]));
  const needEventById = new Map(needs.map((n) => [n.id, n.event_id]));
  const alreadyActedEventIds = new Set([
    ...((foodSignupRows as { item_id: string }[] | null) ?? [])
      .map((s) => itemEventById.get(s.item_id))
      .filter((id): id is string => !!id),
    ...((volunteerSignupRows as { need_id: string }[] | null) ?? [])
      .map((s) => needEventById.get(s.need_id))
      .filter((id): id is string => !!id),
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

// Club boats racing right now (crossed the start, per the GPS trigger in
// 0098), and ones that finished in the last hour, with their place once in.
async function loadRacingBanners(supabase: SupabaseServerClient): Promise<RacingBanner[]> {
  const { data } = await supabase
    .from("lineups")
    .select("id, boat_name, race_name, place, race_started_at, race_finished_at")
    .gte("race_started_at", startOfToday())
    .order("race_started_at", { ascending: false });
  const hourAgo = Date.now() - 60 * 60 * 1000;
  return (
    (data as Pick<Lineup, "id" | "boat_name" | "race_name" | "place" | "race_started_at" | "race_finished_at">[] | null) ??
    []
  )
    .filter((l) => !l.race_finished_at || new Date(l.race_finished_at).getTime() > hourAgo)
    .map((l) => ({
      lineupId: l.id,
      boatName: l.boat_name,
      raceName: l.race_name,
      finished: !!l.race_finished_at,
      place: l.place,
    }));
}

// A regatta boat's cox (or stroke, with no cox) is asked to fill in its oar
// sheet — an oar for every seat, and someone on Launch and Recovery — until
// it's done.
async function loadOarSheetBanners(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<OarSheetBanner[]> {
  // My seats in boats for regattas from today on, with the boat and regatta
  // (one round trip).
  const { data: mySeatRows } = await supabase
    .from("lineup_seats")
    .select(
      "lineup_id, lineups!inner(id, boat_id, boat_name, race_name, schedule_events!inner(title, event_type, starts_at))",
    )
    .eq("rower_id", userId)
    .in("seat_role", ["rower", "coxswain"])
    .not("lineups.boat_id", "is", null)
    .eq("lineups.schedule_events.event_type", "regatta")
    .gte("lineups.schedule_events.starts_at", startOfToday());
  const upcoming = new Map(
    (
      (mySeatRows as unknown as {
        lineup_id: string;
        lineups: {
          id: string;
          boat_name: string;
          race_name: string | null;
          schedule_events: { title: string };
        };
      }[] | null) ?? []
    ).map((r) => [r.lineup_id, r.lineups]),
  );
  if (upcoming.size === 0) return [];
  const ids = [...upcoming.keys()];

  const [{ data: seatRows }, { data: oarRows }, { data: taskRows }] = await Promise.all([
    supabase.from("lineup_seats").select("lineup_id, seat_number, seat_role, rower_id").in("lineup_id", ids),
    supabase.from("lineup_oars").select("lineup_id, seat_number").in("lineup_id", ids),
    supabase.from("coach_tasks").select("lineup_id, coach_task_assignments(user_id)").in("lineup_id", ids),
  ]);
  const seats =
    (seatRows as { lineup_id: string; seat_number: number; seat_role: string; rower_id: string | null }[] | null) ?? [];
  const oars = (oarRows as { lineup_id: string; seat_number: number }[] | null) ?? [];
  const tasks =
    (taskRows as unknown as { lineup_id: string; coach_task_assignments: { user_id: string }[] }[] | null) ?? [];

  return ids
    .filter((id) => {
      const boatSeats = seats.filter((s) => s.lineup_id === id);
      if (captainSeat(boatSeats)?.rower_id !== userId) return false;
      return !oarSheetComplete(
        boatSeats,
        oars.filter((o) => o.lineup_id === id),
        tasks.filter((t) => t.lineup_id === id).map((t) => ({ assigned: t.coach_task_assignments.length })),
      );
    })
    .map((id) => {
      const l = upcoming.get(id)!;
      return { lineupId: id, boatName: l.boat_name, raceName: l.race_name, eventTitle: l.schedule_events.title };
    });
}

// Coach Tasks (e.g. Launch/Recovery) assignment: shown to whoever is
// assigned, whatever their role — a cox can put a parent on Launch from the
// oar sheet. Only to that person, not their parent: it's "which boat am I
// on the hook for," not something to track on someone's behalf.
async function loadCoachTaskBanners(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<CoachTaskBanner[]> {

  const { data: assignmentRows } = await supabase
    .from("coach_task_assignments")
    .select("*")
    .eq("user_id", userId);
  const assignments = (assignmentRows as CoachTaskAssignment[] | null) ?? [];
  if (assignments.length === 0) return [];

  const taskIds = [...new Set(assignments.map((a) => a.task_id))];
  const { data: taskRows } = await supabase
    .from("coach_tasks")
    .select("*")
    .in("id", taskIds);
  const tasks = (taskRows as CoachTask[] | null) ?? [];

  const eventIds = [...new Set(tasks.map((t) => t.event_id))];
  const lineupIds = [
    ...new Set(
      tasks.map((t) => t.lineup_id).filter((id): id is string => !!id),
    ),
  ];
  const raceIds = [
    ...new Set(tasks.map((t) => t.race_id).filter((id): id is string => !!id)),
  ];
  const taskTypeIds = [...new Set(tasks.map((t) => t.task_type_id))];

  const [
    { data: eventRows },
    { data: lineupRows },
    { data: raceRows },
    { data: taskTypeRows },
  ] = await Promise.all([
    supabase
      .from("schedule_events")
      .select("*")
      .in("id", eventIds)
      .gte("starts_at", startOfToday()),
    lineupIds.length
      ? supabase
          .from("lineups")
          .select("id, boat_name, race_name")
          .in("id", lineupIds)
      : Promise.resolve({
          data: [] as Pick<Lineup, "id" | "boat_name" | "race_name">[],
        }),
    // A task auto-created straight off a race import (see importRaces)
    // doesn't have a boat yet — fall back to the race's own name.
    raceIds.length
      ? supabase.from("races").select("id, race_name").in("id", raceIds)
      : Promise.resolve({ data: [] as Pick<Race, "id" | "race_name">[] }),
    supabase.from("task_types").select("*").in("id", taskTypeIds),
  ]);
  const eventById = new Map(
    ((eventRows as ScheduleEvent[] | null) ?? []).map((e) => [e.id, e]),
  );
  const lineupById = new Map(
    (
      (lineupRows as Pick<Lineup, "id" | "boat_name" | "race_name">[] | null) ??
      []
    ).map((l) => [l.id, l]),
  );
  const raceNameByRaceId = new Map(
    ((raceRows as Pick<Race, "id" | "race_name">[] | null) ?? []).map((r) => [
      r.id,
      r.race_name,
    ]),
  );
  const taskTypeNameById = new Map(
    ((taskTypeRows as TaskType[] | null) ?? []).map((t) => [t.id, t.name]),
  );

  return tasks
    .filter((task) => assignments.some((a) => a.task_id === task.id))
    .map((task) => {
      const event = eventById.get(task.event_id);
      if (!event) return null;
      const lineup = task.lineup_id
        ? lineupById.get(task.lineup_id)
        : undefined;
      return {
        taskTypeName: taskTypeNameById.get(task.task_type_id) ?? "a task",
        boatName: lineup?.boat_name ?? null,
        raceName:
          lineup?.race_name ??
          (task.race_id ? (raceNameByRaceId.get(task.race_id) ?? null) : null),
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
  audience: AnnouncementAudience[],
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

  const senderIds = [
    ...new Set(
      announcements.map((a) => a.sender_id).filter((id): id is string => !!id),
    ),
  ];
  const { data: sendersData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", senderIds.length > 0 ? senderIds : [""]);
  const nameById = new Map(
    ((sendersData as Pick<Profile, "id" | "display_name">[] | null) ?? []).map(
      (p) => [p.id, p.display_name],
    ),
  );

  return announcements.map((a) => ({
    id: a.id,
    message: a.message,
    senderName: a.sender_id ? (nameById.get(a.sender_id) ?? "Coach") : "Coach",
    createdAt: new Date(a.created_at).toLocaleDateString(),
  }));
}

// The once-a-day "regatta week" pop-up: what this person should check before
// the next regatta, as tap buttons.
function regattaWeekReminder(
  event: ScheduleEvent,
  who: {
    isFamily: boolean;
    isFoodTentManager: boolean;
    isCoachOrAdmin: boolean;
    hasFoodDraft: boolean;
    needsFoodSignup: boolean;
    isBringingFood: boolean;
    racesWithoutLineup: number;
  },
): { eventId: string; heading: string; links: RegattaWeekLink[] } {
  const eastern = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const days = Math.round(
    (new Date(eastern(new Date(event.starts_at))).getTime() -
      new Date(eastern(new Date())).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  const when =
    days < 0
      ? "is underway"
      : days === 0
        ? "is today"
        : days === 1
          ? "is tomorrow"
          : `is in ${days} days`;

  const links: RegattaWeekLink[] = [];
  if (who.isFoodTentManager && who.hasFoodDraft) {
    links.push({
      href: "/food-tent",
      icon: "food",
      label: "Food Tent",
      detail: "The draft food list is ready to review and publish.",
    });
  } else if (who.isFamily && who.needsFoodSignup) {
    links.push({
      href: "/food-tent",
      icon: "food",
      label: "Food Tent",
      detail: "Sign up to bring something.",
    });
  } else if (who.isFamily && who.isBringingFood) {
    links.push({
      href: "/food-tent",
      icon: "food",
      label: "Food Tent",
      detail: "See what you're bringing.",
    });
  }
  links.push({
    href: `/lineups/${event.id}`,
    icon: "lineups",
    label: "Races & crews",
    detail:
      who.isCoachOrAdmin && who.racesWithoutLineup > 0
        ? `${who.racesWithoutLineup} race${who.racesWithoutLineup === 1 ? " still needs" : "s still need"} a lineup.`
        : "See who's racing and when.",
  });
  links.push({
    href: "/announcements",
    icon: "messages",
    label: "Coach announcements",
    detail: who.isCoachOrAdmin
      ? "Post what the team needs to know."
      : "Read what the coaches have posted.",
  });

  return { eventId: event.id, heading: `${event.title} ${when}!`, links };
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
      .in("key", [
        "team_store_url",
        "team_store_featured_items",
        "nav_visibility",
        "nav_disabled_hrefs",
        NAV_ACCESS_KEY,
        ALERT_SETTINGS_KEY,
      ]),
  ]);
  const settingsByKey = new Map(
    (
      (settingsData as { key: string; value: string | null }[] | null) ?? []
    ).map((s) => [s.key, s.value]),
  );
  const storeUrl = settingsByKey.get("team_store_url") ?? null;
  const featuredItems = parseStoreItems(
    settingsByKey.get("team_store_featured_items") ?? null,
  );
  const navAccess = resolveNavAccess(settingsByKey);

  let banners: FoodTentBanner[] = [];
  let lineupBanners: LineupBanner[] = [];
  let sentLineupNotices: SentLineupNotice[] = [];
  let coachTaskBanners: CoachTaskBanner[] = [];
  let pendingRaceBanners: PendingRaceBanner[] = [];
  let foodPrepBanners: FoodPrepBanner[] = [];
  let signupCallBanners: SignupCallBanner[] = [];
  let announcementBanners: AnnouncementBanner[] = [];
  let oarSheetBanners: OarSheetBanner[] = [];
  let racingBanners: RacingBanner[] = [];
  let birthdaysToday: BirthdayPerson[] = [];
  let myPrs: PrBanner[] = [];
  let upcomingRegatta: ScheduleEvent | null = null;
  let raceDayToday: ScheduleEvent | null = null;
  let emailAlertsOn = true;
  const emailBackupOn = !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
  let lightningHold = null as { last_strike_at: string } | null;
  let practiceCall = null as { status: string; note: string | null } | null;
  let upcomingRegattaForecast: EventForecast | null = null;
  let unreadCount = 0;
  let unreadScheduleCount = 0;
  let coachChatHref = "/messages";
  let getReady = { foodTent: false, volunteer: false, lineups: false, coachMessages: false };
  let isAdmin = false;
  let viewerRole: NavRole | null = null;
  let isCoachOrAdmin = false;
  let isParent = false;
  let isRowerOrCoxswain = false;
  let isFoodTentManager = false;
  let isApparelChair = false;
  let isGlobalAdmin = false;
  let pendingApprovalCount = 0;
  let checkInLabel = null as string | null;
  let myAttendance = null as PracticeAttendance | null;
  let onWaterBanner = null as { label: string; color: string | null } | null;
  let paymentsBanner = null as {
    owedCents: number;
    bills: number;
    openSignups: number;
  } | null;

  let householdUserIds: string[] = [];
  let isFamily = false;

  if (user) {
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // These seven only need the user's id, not each other's results, so run
    // them concurrently instead of one round trip at a time.
    const [
      unreadCountResult,
      unreadScheduleCountResult,
      callerResult,
      coachGroupResult,
      regattaResult,
      globalAdminResult,
      pendingApprovalResult,
    ] = await Promise.all([
      getUnreadChatCount(user.id),
      getUnreadScheduleCount(user.id),
      supabase
        .from("profiles")
        .select("role, spouse_id, is_tent_leader, is_apparel_chair, email_alerts")
        .eq("id", user.id)
        .single(),
      supabase
        .from("chat_groups")
        .select("id")
        .eq("team", "coach")
        .maybeSingle(),
      // Recent and upcoming regattas; the next one is picked below.
      supabase
        .from("schedule_events")
        .select("*")
        .eq("event_type", "regatta")
        .gte(
          "starts_at",
          new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        )
        .lte("starts_at", weekOut.toISOString())
        .order("starts_at", { ascending: true }),
      supabase.rpc("is_global_admin"),
      // RLS only returns other people's pending rows to admins, so this is 0
      // for everyone else.
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .is("approved_at", null)
        .neq("id", user.id),
    ]);

    pendingApprovalCount = pendingApprovalResult.count ?? 0;

    isGlobalAdmin = globalAdminResult.data === true;

    unreadCount = unreadCountResult;
    unreadScheduleCount = unreadScheduleCountResult;

    const caller = callerResult.data as Pick<
      Profile,
      "role" | "spouse_id" | "is_tent_leader" | "is_apparel_chair" | "email_alerts"
    > | null;
    const callerRole = caller?.role;
    emailAlertsOn = caller?.email_alerts ?? true;
    viewerRole = (callerRole as NavRole | undefined) ?? null;
    isAdmin = callerRole === "admin";
    isCoachOrAdmin = callerRole === "admin" || callerRole === "coach";
    isParent = callerRole === "parent";
    isRowerOrCoxswain = callerRole === "rower" || callerRole === "coxswain";
    isFoodTentManager = isCoachOrAdmin || Boolean(caller?.is_tent_leader);
    isApparelChair = Boolean(caller?.is_apparel_chair);

    if ((coachGroupResult.data as Pick<ChatGroup, "id"> | null)?.id) {
      coachChatHref = `/messages/${(coachGroupResult.data as Pick<ChatGroup, "id">).id}`;
    }
    // The next regatta still to race: one stays "next" through midnight
    // (Eastern) after its last day, then the following one takes over, along
    // with its weather.
    raceDayToday = pickRaceDayEvent((regattaResult.data as ScheduleEvent[] | null) ?? []);
    if (raceDayToday && clubDateKey(raceDayToday.starts_at) > clubDateKey(now)) raceDayToday = null;

    upcomingRegatta =
      ((regattaResult.data as ScheduleEvent[] | null) ?? []).find(
        (e) => forecastDayFor(e) !== null,
      ) ?? null;
    householdUserIds = [user.id];

    // None of these depend on each other, so they run at the same time
    // (one round trip each instead of one after another).
    await Promise.all([
      (async () => {
        if (isCoachOrAdmin) checkInLabel = await getTodaysCheckInLabel(user.id);
      })(),
      (async () => {
        if (isRowerOrCoxswain) myAttendance = await getMyAttendanceToday(user.id);
      })(),
      (async () => {
        // Boats out right now. RLS scopes this: coaches and admins see every
        // outing, a coxswain only their own.
        if (isCoachOrAdmin || callerRole === "coxswain") {
          const { data: outingsData } = await supabase
            .from("on_water_sessions")
            .select("coxswain_id, color, boats(name)")
            .is("ended_at", null)
            .order("started_at", { ascending: true });
          const outings =
            (outingsData as unknown as
              | {
                  coxswain_id: string;
                  color: string | null;
                  boats: { name: string } | null;
                }[]
              | null) ?? [];
          const mine = outings.find((o) => o.coxswain_id === user.id);
          if (mine) {
            onWaterBanner = {
              label: `You're tracking ${mine.boats?.name ?? "your boat"} — tap to open`,
              color: mine.color,
            };
          } else if (isCoachOrAdmin && outings.length > 0) {
            const names = outings.map((o) => o.boats?.name ?? "a boat").join(", ");
            onWaterBanner = {
              label: `🚣 ${outings.length} ${outings.length === 1 ? "boat" : "boats"} on the water: ${names}`,
              color: null,
            };
          }
        }
      })(),
      (async () => {
        // What this household owes for its own rowers (a treasurer or admin can
        // read every bill, so this filters to the family's rowers explicitly),
        // and any season open for sign-up.
        const { data: myLinks } = await supabase
          .from("family_links")
          .select("rower_id")
          .in("guardian_id", [
            user.id,
            ...(caller?.spouse_id ? [caller.spouse_id] : []),
          ]);
        const myRowerIds = [
          ...(isRowerOrCoxswain ? [user.id] : []),
          ...((myLinks as { rower_id: string }[] | null) ?? []).map(
            (l) => l.rower_id,
          ),
        ];
        const [{ data: owedBills }, { count: openSignups }] = await Promise.all([
          myRowerIds.length
            ? supabase
                .from("bills")
                .select("id, amount_cents, discount_cents")
                .eq("status", "owed")
                .in("rower_id", myRowerIds)
            : Promise.resolve({ data: [] }),
          supabase
            .from("charges")
            .select("id", { count: "exact", head: true })
            .eq("signup_open", true)
            .is("archived_at", null),
        ]);
        const owed =
          (owedBills as
            | { id: string; amount_cents: number; discount_cents: number }[]
            | null) ?? [];
        let owedCents = 0;
        if (owed.length) {
          const { data: paidRows } = await supabase
            .from("payments")
            .select("bill_id, amount_cents")
            .eq("status", "succeeded")
            .in(
              "bill_id",
              owed.map((b) => b.id),
            );
          const paidCents = (
            (paidRows as { amount_cents: number }[] | null) ?? []
          ).reduce((t, p) => t + p.amount_cents, 0);
          owedCents =
            owed.reduce((t, b) => t + b.amount_cents - b.discount_cents, 0) -
            paidCents;
        }
        if (owedCents > 0 || ((openSignups ?? 0) > 0 && myRowerIds.length > 0)) {
          paymentsBanner = {
            owedCents: Math.max(0, owedCents),
            bills: owed.length,
            openSignups: openSignups ?? 0,
          };
        }
      })(),
      (async () => {
        const [{ data: holdRows }, { data: callRow }] = await Promise.all([
          supabase.from("lightning_holds").select("last_strike_at").is("cleared_at", null).limit(1),
          supabase.from("practice_calls").select("status, note").eq("practice_date", clubDateKey(now)).maybeSingle(),
        ]);
        lightningHold = ((holdRows as { last_strike_at: string }[] | null) ?? [])[0] ?? null;
        practiceCall = callRow as { status: string; note: string | null } | null;
      })(),
      (async () => {
        // The "get ready" buttons each go away once followed: Food Tent and
        // Volunteer once visited, Lineups only once boats have crews and until
        // viewed, coaches' messages only while there's one unread.
        if (upcomingRegatta) {
          const coachGroupId = (coachGroupResult.data as Pick<ChatGroup, "id"> | null)?.id ?? null;
          const [seen, { data: crewedLineups }, { data: coachMembership }] = await Promise.all([
            regattaPrepSeen(supabase, user.id, upcomingRegatta.id),
            supabase
              .from("lineups")
              .select("id, lineup_seats!inner(rower_id)")
              .eq("event_id", upcomingRegatta.id)
              .not("lineup_seats.rower_id", "is", null)
              .limit(1),
            coachGroupId
              ? supabase
                  .from("chat_group_members")
                  .select("last_read_at")
                  .eq("group_id", coachGroupId)
                  .eq("user_id", user.id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          const lastRead = (coachMembership as { last_read_at: string } | null)?.last_read_at;
          const { count: coachUnread } =
            coachGroupId && lastRead
              ? await supabase
                  .from("messages")
                  .select("id", { count: "exact", head: true })
                  .eq("group_id", coachGroupId)
                  .neq("sender_id", user.id)
                  .gt("created_at", lastRead)
              : { count: 0 };
          getReady = {
            foodTent: !seen.has("food_tent"),
            volunteer: !seen.has("volunteer"),
            lineups: (crewedLineups ?? []).length > 0 && !seen.has("lineups"),
            coachMessages: (coachUnread ?? 0) > 0,
          };
        }
      })(),
      (async () => {
        if (isParent) {
          // Spouses are linked one-directionally, so check both: the caller's
          // own spouse_id, and anyone whose spouse_id points back at the caller.
          const { data: reverseSpouses } = await supabase
            .from("profiles")
            .select("id")
            .eq("spouse_id", user.id);
          const spouseIds = new Set<string>(
            ((reverseSpouses as Pick<Profile, "id">[] | null) ?? []).map(
              (p) => p.id,
            ),
          );
          if (caller?.spouse_id) spouseIds.add(caller.spouse_id);
          householdUserIds.push(...spouseIds);
        }
      })(),
    ]);
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
      oarSheetBannerResults,
      racingBannerResults,
      pendingRaceBannerResults,
      familyLinkRows,
      foodPrepBannerResults,
      signupCallBannerResults,
      forecastResult,
      announcementBannerResults,
      sentLineupNoticeResults,
      birthdayResults,
      prResults,
    ] = await Promise.all([
      loadFoodTentBanners(supabase, householdUserIds),
      loadLineupBanners(supabase, {
        userId: user.id,
        isRowerOrCoxswain,
        isParent,
        isCoachOrAdmin,
        householdUserIds,
      }),
      loadCoachTaskBanners(supabase, user.id),
      loadOarSheetBanners(supabase, user.id),
      loadRacingBanners(supabase),
      isCoachOrAdmin ? loadPendingRaceBanners(supabase) : Promise.resolve([]),
      supabase
        .from("family_links")
        .select("rower_id")
        .in("guardian_id", householdUserIds),
      isFoodTentManager ? loadFoodPrepBanners(supabase) : Promise.resolve([]),
      loadSignupCallBanners(supabase, householdUserIds),
      upcomingRegatta
        ? getOrRefreshEventForecast(supabase, upcomingRegatta)
        : Promise.resolve(null),
      isRowerOrCoxswain
        ? loadAnnouncementBanners(supabase, ["rowers", "both"])
        : isParent
          ? loadAnnouncementBanners(supabase, ["parents", "both"])
          : Promise.resolve([]),
      isCoachOrAdmin
        ? loadSentLineupNotices(supabase, user.id)
        : Promise.resolve([]),
      loadBirthdaysToday(supabase),
      loadMyRecentPrs(supabase, user.id),
    ]);
    sentLineupNotices = sentLineupNoticeResults;
    banners = foodBanners;
    upcomingRegattaForecast = forecastResult;
    lineupBanners = lineupBannerResults;
    coachTaskBanners = coachTaskBannerResults;
    oarSheetBanners = oarSheetBannerResults;
    racingBanners = racingBannerResults;
    pendingRaceBanners = pendingRaceBannerResults;
    foodPrepBanners = foodPrepBannerResults;
    announcementBanners = announcementBannerResults;
    birthdaysToday = birthdayResults;
    myPrs = prResults;
    const isGuardian = (familyLinkRows.data ?? []).length > 0;
    isFamily = isParent || isGuardian;
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
      if (
        upcomingRegatta &&
        !banners.some((b) => b.eventId === upcomingRegatta!.id)
      ) {
        banners.push({
          eventId: upcomingRegatta.id,
          eventTitle: upcomingRegatta.title,
          eventDate: new Date(upcomingRegatta.starts_at).toLocaleDateString(),
          items: [{ emoji: "💧", label: "2 gal of water" }],
        });
      }
    }
  }

  const regattaWeek =
    upcomingRegatta && parseAlertSettings(settingsByKey.get(ALERT_SETTINGS_KEY)).regatta_week_popup
    ? regattaWeekReminder(upcomingRegatta, {
        isFamily,
        isFoodTentManager,
        isCoachOrAdmin,
        hasFoodDraft: foodPrepBanners.some((b) => b.eventId === upcomingRegatta!.id),
        needsFoodSignup: signupCallBanners.some((b) => b.eventId === upcomingRegatta!.id),
        isBringingFood: banners.some(
          (b) => b.eventId === upcomingRegatta!.id && b.items.some((i) => !i.label.includes("gal of water")),
        ),
        racesWithoutLineup:
          pendingRaceBanners.find((b) => b.eventTitle === upcomingRegatta!.title)?.count ?? 0,
      })
    : null;

  const demoClub = findDemoClub((await cookies()).get(DEMO_CLUB_COOKIE)?.value);
  // Banners already clicked through to Food Tent / Volunteer Needs stay
  // hidden (the regatta-week popup still counts them as not signed up).
  const signupCallSeen = new Set(
    parseSignupCallSeen((await cookies()).get(SIGNUP_CALL_SEEN_COOKIE)?.value),
  );
  const visibleSignupCallBanners = signupCallBanners.filter(
    (b) => !signupCallSeen.has(b.eventId),
  );
  const demoProfile = DEMO_PROFILES.find((p) => p.email === user?.email) ?? null;
  const hotcSchedule = demoClub ? await getHotcSchedule(demoClub) : null;
  if (isCoachOrAdmin) await syncHotcResults(supabase, hotcSchedule);
  const hotcOver =
    new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }) >
    HOTC.lastDay;
  const hotcResults = hotcOver
    ? []
    : (hotcSchedule?.races ?? [])
        .filter((r) => r.place != null)
        .sort((a, b) => (a.place as number) - (b.place as number));

  return (
    <div className="min-h-screen p-8 flex flex-col items-center gap-8">
      {demoClub ? (
        <div className="w-full flex flex-col items-center gap-2 text-center">
          {demoClub.blade && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={demoClub.blade}
              alt=""
              width={198}
              height={108}
              className="max-w-full h-auto"
            />
          )}
          <h1 className="text-2xl font-bold leading-tight text-[var(--color-primary)]">
            {demoClub.name}
          </h1>
          <Link href="/choose-club" className="text-xs text-gray-500 underline">
            Change club
          </Link>
        </div>
      ) : (
        <Link href="/choose-club" className="text-sm text-gray-600 underline">
          See it in your club&apos;s colors →
        </Link>
      )}
      {demoProfile && (
        <p className="-mt-6 text-xs text-gray-500">
          Viewing as {demoProfile.label} ·{" "}
          <Link href="/choose-profile" className="underline">
            Switch
          </Link>
        </p>
      )}

      {user && isCoachOrAdmin && <CheckInButton checkedInAt={checkInLabel} />}
      {user && isRowerOrCoxswain && (
        <PracticeCheckIn
          status={myAttendance?.status ?? null}
          reason={myAttendance?.reason ?? null}
          time={
            myAttendance
              ? formatAttendanceTime(myAttendance.responded_at)
              : null
          }
          reasons={ABSENCE_REASONS}
        />
      )}

      {onWaterBanner && (
        <Link
          href="/on-water"
          className="w-full flex items-center gap-3 rounded-lg border-2 border-[var(--color-primary)] px-4 py-3 font-medium hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
        >
          {onWaterBanner.color &&
          /^#[0-9a-f]{6}$/i.test(onWaterBanner.color) ? (
            <span
              className="w-5 h-5 shrink-0 rounded-full"
              style={{ backgroundColor: onWaterBanner.color }}
              aria-hidden
            />
          ) : (
            <Navigation className="w-5 h-5 shrink-0" aria-hidden />
          )}
          <span className="flex-1">{onWaterBanner.label}</span>
          <span aria-hidden>→</span>
        </Link>
      )}

      {paymentsBanner && (
        <Link
          href="/payments"
          className="w-full flex items-center gap-3 rounded-lg border-2 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-900"
        >
          <CreditCard className="w-5 h-5 shrink-0" />
          <span>
            {paymentsBanner.owedCents > 0 && (
              <>
                You owe <strong>{formatMoney(paymentsBanner.owedCents)}</strong>
                {paymentsBanner.bills > 1 &&
                  ` on ${paymentsBanner.bills} bills`}
                .{" "}
              </>
            )}
            {paymentsBanner.openSignups > 0 && "Season sign-up is open. "}
            <span className="underline">Go to Payments →</span>
          </span>
        </Link>
      )}

      {hotcResults.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {hotcResults.map((r, i) => {
            const place = r.place as number;
            const isMedal = place <= 3;
            const medalStyle =
              place === 1
                ? "bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 text-yellow-950 border-2 border-yellow-600"
                : place === 2
                  ? "bg-gradient-to-r from-gray-200 via-slate-300 to-gray-200 text-gray-900 border-2 border-gray-500"
                  : place === 3
                    ? "bg-gradient-to-r from-[#8a5a2e] via-[#cd8347] to-[#8a5a2e] text-orange-50 border-2 border-[#5c3a1e]"
                    : i % 2 === 0
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-secondary)] text-white";

            return (
              <Link
                key={`${r.eventNum}-${r.bow ?? i}`}
                href="/regatta"
                className={`relative overflow-hidden rounded-lg px-4 py-3 text-sm font-medium ${medalStyle}`}
              >
                {isMedal && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 flex items-center justify-around text-lg opacity-40"
                  >
                    <span>🎉</span>
                    <span>✨</span>
                    <span>🎊</span>
                    <span>✨</span>
                    <span>🎉</span>
                  </span>
                )}
                <span className="relative flex items-center gap-2">
                  {isMedal && (
                    <Trophy className="w-5 h-5 shrink-0 animate-bounce" />
                  )}
                  <span>
                    <strong>Race {r.eventNum}</strong> — {r.eventName}:{" "}
                    {placeEmoji(place)}{" "}
                    <strong>{ordinalPlace(place)} place</strong>
                    {r.time && <> · {r.time}</>}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {!hotcOver && (
        <Link
          href="/regatta"
          className="w-full flex items-center gap-3 border-2 border-[var(--color-primary)] rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
        >
          <Waves className="w-5 h-5 shrink-0 text-[var(--color-primary)]" />
          <span>
            <strong>{HOTC.title}</strong>:{" "}
            {!demoClub
              ? "pick your club to see its races"
              : hotcSchedule && hotcSchedule.races.length > 0
                ? `${hotcSchedule.races.length} race${hotcSchedule.races.length === 1 ? "" : "s"} for ${demoClub.name}${hotcSchedule.races[0].start ? `, first at ${hotcSchedule.races[0].start}` : ""}`
                : "race schedule and live results"}{" "}
            →
          </span>
        </Link>
      )}

      <Link
        href="/interest"
        className="w-full block text-center bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded-lg px-4 py-3 font-medium hover:bg-[var(--color-accent)] transition-colors"
      >
        🙋 Yes, I&apos;m interested in this software. Please let me know when
        it&apos;s available!
      </Link>

      {pendingApprovalCount > 0 && (
        <Link
          href="/roster"
          className="w-full block text-center bg-amber-100 border-2 border-amber-400 rounded-lg px-4 py-3 text-sm font-medium hover:bg-amber-200 transition-colors"
        >
          {pendingApprovalCount}{" "}
          {pendingApprovalCount === 1 ? "person is" : "people are"} waiting for
          approval →
        </Link>
      )}

      {birthdaysToday.some((p) => p.id === user?.id) && (
        <div className="w-full rounded-lg bg-gradient-to-r from-pink-400 via-amber-300 to-sky-400 px-4 py-3 text-center font-semibold text-gray-900">
          🎂 Happy birthday,{" "}
          {birthdaysToday.find((p) => p.id === user?.id)?.first_name ||
            birthdaysToday.find((p) => p.id === user?.id)?.display_name}
          ! 🎉
        </div>
      )}

      {birthdaysToday.some((p) => p.id !== user?.id) && (
        <div className="w-full flex items-center gap-3 rounded-lg border-2 border-pink-300 bg-pink-50 px-4 py-3 text-sm text-pink-950">
          <span className="text-lg" aria-hidden>
            🎂
          </span>
          <span>
            It&apos;s{" "}
            {birthdaysToday
              .filter((p) => p.id !== user?.id)
              .map((p, i, all) => (
                <span key={p.id}>
                  {i > 0 && (i === all.length - 1 ? " and " : ", ")}
                  <Link href={`/roster/${p.id}`} className="font-semibold underline">
                    {p.display_name}
                  </Link>
                </span>
              ))}
            &apos;s birthday today!
          </span>
        </div>
      )}

      {myPrs.map((pr) => (
        <div
          key={pr.id}
          className="w-full flex items-center gap-3 rounded-lg border-2 border-yellow-600 bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 px-4 py-3 text-sm text-yellow-950"
        >
          <Trophy className="w-5 h-5 shrink-0" />
          <span>
            <strong>New {pr.distance.toUpperCase()} PR: {pr.time_text}!</strong>
            {pr.previous_best_seconds != null && (
              <>
                {" "}
                That&apos;s{" "}
                {(Number(pr.previous_best_seconds) - Number(pr.seconds)).toFixed(1)}s
                faster than your old best (
                {formatErgSeconds(Number(pr.previous_best_seconds))}).
              </>
            )}
          </span>
        </div>
      ))}

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
                still need{b.count === 1 ? "s" : ""} a lineup for {b.eventTitle}{" "}
                ({b.eventDate})
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
                The food list for <strong>{b.eventTitle}</strong> ({b.eventDate}
                ) was auto-filled from the last regatta — review, edit if
                needed, and publish it.
              </span>
            </Link>
          ))}
        </div>
      )}

      {visibleSignupCallBanners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {visibleSignupCallBanners.map((b, i) => (
            <div
              key={i}
              className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm flex flex-col gap-2"
            >
              <p>
                📋 Signups are open for <strong>{b.eventTitle}</strong> (
                {b.eventDate}) — pick a food tent item
                {b.hasVolunteerNeeds ? " and a volunteer slot" : ""}.
              </p>
              <div className="flex gap-2">
                <SignupCallLink
                  href="/food-tent"
                  eventId={b.eventId}
                  className="text-xs bg-white text-[var(--color-primary)] rounded px-2 py-1 font-medium"
                >
                  Food Tent
                </SignupCallLink>
                {b.hasVolunteerNeeds && (
                  <SignupCallLink
                    href="/volunteer"
                    eventId={b.eventId}
                    className="text-xs bg-white text-[var(--color-primary)] rounded px-2 py-1 font-medium"
                  >
                    Volunteer Needs
                  </SignupCallLink>
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
            <img
              src={upcomingRegattaForecast.icon_url}
              alt=""
              className="w-10 h-10 shrink-0"
            />
          )}
          <span>
            Forecast for <strong>{upcomingRegatta.title}</strong> (
            {upcomingRegattaForecast.forecast_date
              ? new Date(
                  `${upcomingRegattaForecast.forecast_date}T12:00:00`,
                ).toLocaleDateString()
              : new Date(upcomingRegatta.starts_at).toLocaleDateString()}
            ): <strong>{upcomingRegattaForecast.short_forecast}</strong>
            {upcomingRegattaForecast.high_f !== null && (
              <>, high {upcomingRegattaForecast.high_f}°F</>
            )}
            {upcomingRegattaForecast.low_f !== null && (
              <>, low {upcomingRegattaForecast.low_f}°F</>
            )}
            {upcomingRegattaForecast.precipitation_chance !== null &&
              upcomingRegattaForecast.precipitation_chance > 0 && (
                <>
                  , {upcomingRegattaForecast.precipitation_chance}% chance of
                  rain
                </>
              )}
            {upcomingRegattaForecast.wind && (
              <>, wind {upcomingRegattaForecast.wind}</>
            )}
          </span>
        </div>
      )}

      {upcomingRegatta && Object.values(getReady).some(Boolean) && (
        <div className="w-full flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">
            {upcomingRegatta.title} is coming up on{" "}
            {new Date(upcomingRegatta.starts_at).toLocaleDateString()} — get
            ready:
          </p>
          {getReady.foodTent && (
            <Link
              href="/food-tent"
              className="flex items-center gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-accent)] transition-colors"
            >
              <Tent className="w-5 h-5 shrink-0" />
              Sign up for the food tent
            </Link>
          )}
          {getReady.volunteer && (
            <Link
              href="/volunteer"
              className="flex items-center gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-accent)] transition-colors"
            >
              <HelpingHand className="w-5 h-5 shrink-0" />
              Sign up for a volunteer slot
            </Link>
          )}
          {getReady.lineups && (
            <Link
              href={`/lineups/${upcomingRegatta.id}`}
              className="flex items-center gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-accent)] transition-colors"
            >
              <Waves className="w-5 h-5 shrink-0" />
              Check the lineups
            </Link>
          )}
          {getReady.coachMessages && (
            <Link
              href={coachChatHref}
              className="flex items-center gap-3 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-accent)] transition-colors"
            >
              <MessageCircle className="w-5 h-5 shrink-0" />
              Read coaches&apos; messages
            </Link>
          )}
        </div>
      )}

      {racingBanners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {racingBanners.some((b) => !b.finished) && <AutoRefresh seconds={15} />}
          {racingBanners.map((b) =>
            b.finished ? (
              <Link
                key={b.lineupId}
                href="/race-day"
                className="w-full flex items-center gap-2 bg-[var(--color-secondary)] text-white rounded-lg px-4 py-3 text-sm"
              >
                🏁 <strong>{b.boatName}</strong> finished
                {b.raceName && <> {b.raceName}</>}
                {b.place != null && (
                  <>
                    {" "}— {placeEmoji(b.place)} {ordinalPlace(b.place)}
                  </>
                )}
              </Link>
            ) : (
              <Link
                key={b.lineupId}
                href="/on-water"
                className="w-full flex items-center gap-2 bg-green-600 text-white rounded-lg px-4 py-3 font-semibold"
              >
                🚣 {b.boatName} is racing now{b.raceName && <span className="font-normal"> · {b.raceName}</span>}
                <span className="ml-auto text-sm font-normal underline">Watch live</span>
              </Link>
            ),
          )}
        </div>
      )}

      {lightningHold && (
        <Link href="/water" className="w-full flex items-center gap-2 bg-red-700 text-white rounded-lg px-4 py-3 font-semibold">
          <CloudLightning className="w-5 h-5 shrink-0" />
          Lightning hold: stay off the water.
          {lightningMinutesLeft(lightningHold.last_strike_at) > 0
            ? ` ${lightningMinutesLeft(lightningHold.last_strike_at)} min left.`
            : " Waiting on the all clear."}
        </Link>
      )}

      {practiceCall && practiceCall.status !== "go" && (
        <Link
          href="/water"
          className={`w-full rounded-lg px-4 py-3 text-sm text-white ${
            practiceCall.status === "cancelled" ? "bg-red-700" : practiceCall.status === "land" ? "bg-blue-700" : "bg-amber-600"
          }`}
        >
          <span className="font-semibold">Today: {PRACTICE_CALL_LABELS[practiceCall.status]}</span>
          {practiceCall.note && <span className="block">{practiceCall.note}</span>}
        </Link>
      )}

      {raceDayToday && (
        <Link
          href="/race-day"
          className="w-full flex items-center gap-2 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium"
        >
          <StarterFlag className="w-5 h-5 shrink-0" />
          Race day: {raceDayToday.title}. Launch times, bow numbers and crews →
        </Link>
      )}

      {lineupBanners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {lineupBanners.map((b, i) => (
            <div
              key={i}
              className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm"
            >
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
                  {" "}
                  (<strong>{b.raceName}</strong>)
                </>
              )}{" "}
              at {b.eventTitle} ({b.eventDate}
              {b.raceTimeLabel && (
                <>
                  , racing at <strong>{b.raceTimeLabel}</strong>
                </>
              )}
              )
            </div>
          ))}
        </div>
      )}

      {sentLineupNotices.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {sentLineupNotices.map((n) => (
            <div
              key={n.lineupId}
              className="border border-[var(--color-primary)] rounded-lg px-4 py-3 text-sm flex flex-col gap-2"
            >
              <p className="font-semibold text-[var(--color-primary)]">
                📣 Rower notification sent — {n.boatName}
              </p>
              <div className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-3">
                🚣 You&apos;re in the boat for <strong>{n.boatName}</strong>
                {n.raceName && (
                  <>
                    {" "}
                    (<strong>{n.raceName}</strong>)
                  </>
                )}{" "}
                at {n.eventTitle} ({n.eventDate}
                {n.raceTimeLabel && (
                  <>
                    , racing at <strong>{n.raceTimeLabel}</strong>
                  </>
                )}
                )
              </div>
              <p className="text-gray-600">
                Sent to {n.recipientNames.length}: {n.recipientNames.join(", ")}
              </p>
            </div>
          ))}
        </div>
      )}

      {oarSheetBanners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {oarSheetBanners.map((b) => (
            <Link
              key={b.lineupId}
              href={`/oar-sheet/${b.lineupId}`}
              className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm hover:bg-[var(--color-accent)] transition-colors"
            >
              🚣 Fill in the oar sheet for <strong>{b.boatName}</strong>
              {b.raceName && <> ({b.raceName})</>} at {b.eventTitle}: pick
              the oars and who does Launch and Recovery.
            </Link>
          ))}
        </div>
      )}

      {coachTaskBanners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {coachTaskBanners.map((b, i) => (
            <div
              key={i}
              className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm"
            >
              📋 You&apos;re on <strong>{b.taskTypeName}</strong>
              {b.boatName && (
                <>
                  {" "}
                  for <strong>{b.boatName}</strong>
                </>
              )}{" "}
              at {b.eventTitle}
              {b.raceName && (
                <>
                  {" "}
                  (<strong>{b.raceName}</strong>)
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
                You&apos;re bringing to <strong>{b.eventTitle}</strong> (
                {b.eventDate}):
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

      {user && <PushToggle isDemo={isDemoEmail(user.email)} />}
      {user && !isDemoEmail(user.email) && emailBackupOn && <EmailAlertsToggle initial={emailAlertsOn} />}

      {regattaWeek && (
        <RegattaWeekPopup
          eventId={regattaWeek.eventId}
          heading={regattaWeek.heading}
          links={regattaWeek.links}
        />
      )}

      <div className="w-full grid grid-cols-3 gap-4">
        {NAV_SECTIONS.filter((s) =>
          viewerRole ? navAccess[viewerRole].includes(s.href) : false,
        )
          .concat(
            isAdmin
              ? [
                  { href: "/todo", label: "To-do List" },
                  { href: "/admin", label: "Admin Settings" },
                ]
              : [],
          )
          .concat(
            isAdmin || isApparelChair
              ? [{ href: "/apparel/manage", label: "Manage Apparel" }]
              : [],
          )
          .concat(
            isGlobalAdmin
              ? [{ href: "/global-admin", label: "Global Admin" }]
              : [],
          )
          .map((s) => {
            const Icon = ICONS_BY_HREF[s.href];
            const badgeCount =
              s.href === "/messages"
                ? unreadCount
                : s.href === "/schedule"
                  ? unreadScheduleCount
                  : 0;
            return (
              <Link
                key={s.href}
                href={s.href}
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
                  <p className="text-sm font-medium leading-tight">
                    {item.title}
                  </p>
                  {item.price && (
                    <p className="text-xs text-gray-500 mt-0.5">{item.price}</p>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {IS_DEMO_SITE && <QrCodes compact />}
    </div>
  );
}
