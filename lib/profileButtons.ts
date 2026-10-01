import type { NavRole, NavSectionDef } from "@/lib/navSections";
import { NAV_ROLES } from "@/lib/navSections";

// Shortcut buttons on a member's own profile page, set from /admin: pick a
// group, then which buttons they get. Stored in club_settings
// "profile_buttons" as { group: [href, ...] }. Board members get their
// role's buttons plus the "board" list.
export type ProfileGroup = NavRole | "board";
export const PROFILE_GROUPS: { group: ProfileGroup; label: string }[] = [
  ...NAV_ROLES.map(({ role, label }) => ({ group: role as ProfileGroup, label })),
  { group: "board", label: "Board Member" },
];
export const PROFILE_BUTTONS_KEY = "profile_buttons";

export const PROFILE_BUTTONS: NavSectionDef[] = [
  { href: "/workouts", label: "Workouts" },
  { href: "/schedule", label: "Schedule" },
  { href: "/lineups", label: "Lineups" },
  { href: "/race-day", label: "Race Day" },
  { href: "/walk-up-songs", label: "Walk-up Song" },
  { href: "/payments", label: "Payments" },
  { href: "/volunteer", label: "Volunteer" },
  { href: "/food-tent", label: "Food Tent" },
  { href: "/messages", label: "Messages" },
  { href: "/photos", label: "Photos" },
  { href: "/polls", label: "Polls" },
  { href: "/forms", label: "Forms & Elections" },
  { href: "/announcements", label: "Announcements" },
  { href: "/suggestions", label: "Suggestions" },
  { href: "/coach/attendance", label: "Attendance" },
  { href: "/coach/seat-racing", label: "Seat Racing" },
  { href: "/coach/paperwork", label: "Paperwork" },
  { href: "/coach/emergency", label: "Emergency Info" },
  { href: "/coach/tasks", label: "Tasks" },
  { href: "/coach/programs", label: "Program Sign-ups" },
  { href: "/payments/manage", label: "Manage Payments" },
  { href: "/admin", label: "Admin Settings" },
];

// Pages that only work for some roles, whatever the setting says. The board
// group can hold any role, so it only gets buttons with no limit.
const COACH_AREA: NavRole[] = ["coach", "admin"];
const ROLE_LIMITS: Record<string, NavRole[]> = {
  "/coach/attendance": COACH_AREA,
  "/coach/seat-racing": COACH_AREA,
  "/coach/paperwork": COACH_AREA,
  "/coach/emergency": COACH_AREA,
  "/coach/tasks": COACH_AREA,
  "/coach/programs": COACH_AREA,
  "/payments/manage": ["admin"],
  "/admin": ["admin"],
};

export function profileButtonsFor(group: ProfileGroup): NavSectionDef[] {
  return PROFILE_BUTTONS.filter(
    (b) => !ROLE_LIMITS[b.href] || (group !== "board" && ROLE_LIMITS[b.href].includes(group))
  );
}

// What each group gets before an admin has chosen.
const DEFAULTS: Record<ProfileGroup, string[]> = {
  rower: ["/workouts", "/schedule", "/lineups", "/walk-up-songs", "/messages"],
  coxswain: ["/workouts", "/schedule", "/lineups", "/walk-up-songs", "/messages"],
  parent: ["/workouts", "/schedule", "/payments", "/volunteer", "/food-tent", "/messages"],
  coach: ["/schedule", "/lineups", "/coach/attendance", "/coach/seat-racing", "/coach/paperwork", "/messages"],
  admin: ["/schedule", "/lineups", "/coach/attendance", "/payments/manage", "/admin", "/messages"],
  board: ["/announcements", "/polls", "/forms", "/suggestions"],
};

// Saved alongside the lists: every button that existed when they were saved,
// so a button added later starts at its default instead of off.
export const PROFILE_KNOWN_KEY = "_known";

export function resolveProfileButtons(
  settingsByKey: Map<string, string | null>
): Record<ProfileGroup, string[]> {
  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(settingsByKey.get(PROFILE_BUTTONS_KEY) ?? "{}") ?? {};
  } catch {
    saved = {};
  }
  const known = Array.isArray(saved[PROFILE_KNOWN_KEY]) ? (saved[PROFILE_KNOWN_KEY] as unknown[]) : null;

  const access = {} as Record<ProfileGroup, string[]>;
  for (const { group } of PROFILE_GROUPS) {
    const allowed = profileButtonsFor(group).map((b) => b.href);
    const list = saved[group];
    access[group] = Array.isArray(list)
      ? allowed.filter(
          (href) => list.includes(href) || (known != null && !known.includes(href) && DEFAULTS[group].includes(href))
        )
      : allowed.filter((href) => DEFAULTS[group].includes(href));
  }
  return access;
}

// The buttons one member sees on their own profile, in list order.
export function profileButtonsForMember(
  access: Record<ProfileGroup, string[]>,
  role: NavRole,
  isBoardMember: boolean
): NavSectionDef[] {
  const on = new Set(access[role] ?? []);
  if (isBoardMember) for (const href of access.board) on.add(href);
  return PROFILE_BUTTONS.filter(
    (b) => on.has(b.href) && (!ROLE_LIMITS[b.href] || ROLE_LIMITS[b.href].includes(role))
  );
}

// Puts a member's buttons in their saved order. Buttons missing from the
// order (turned on by an admin since) keep their place at the end; hrefs no
// longer offered are dropped.
export function orderProfileButtons(buttons: NavSectionDef[], order: string[] | null): NavSectionDef[] {
  if (!order?.length) return buttons;
  const rank = new Map(order.map((href, i) => [href, i]));
  const at = (href: string) => rank.get(href) ?? order.length;
  return [...buttons].sort((a, b) => at(a.href) - at(b.href));
}
