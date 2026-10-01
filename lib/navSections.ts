export interface NavSectionDef {
  href: string;
  label: string;
}

// Per-href home-screen visibility, set from /admin: everyone (default),
// coaches (and admins), admins only, or off for everyone.
export type NavVisibility = "everyone" | "coaches" | "admins" | "off";
export const NAV_VISIBILITY_OPTIONS: NavVisibility[] = ["everyone", "coaches", "admins", "off"];

// Reads the club_settings "nav_visibility" JSON blob, falling back to the
// older binary "nav_disabled_hrefs" list (pre-3-way-toggle) so existing
// off-for-everyone settings survive until re-saved from the new /admin form.
export function resolveNavVisibility(
  settingsByKey: Map<string, string | null>
): Record<string, NavVisibility> {
  let visibilityByHref: Record<string, NavVisibility> = {};
  try {
    visibilityByHref = JSON.parse(settingsByKey.get("nav_visibility") ?? "{}");
  } catch {
    visibilityByHref = {};
  }

  if (Object.keys(visibilityByHref).length === 0) {
    let disabledHrefs: string[] = [];
    try {
      disabledHrefs = JSON.parse(settingsByKey.get("nav_disabled_hrefs") ?? "[]");
    } catch {
      disabledHrefs = [];
    }
    for (const href of disabledHrefs) visibilityByHref[href] = "off";
  }

  return visibilityByHref;
}

// Every home-page tile an admin can hide via /admin. "/todo" (the internal
// backlog view) is intentionally excluded — it's a dev tool, not a
// team-facing feature.
export const NAV_SECTIONS: NavSectionDef[] = [
  { href: "/roster", label: "Roster" },
  { href: "/race-day", label: "Race Day" },
  { href: "/lineups", label: "Lineups" },
  { href: "/boats", label: "Boats" },
  { href: "/on-water", label: "On the Water" },
  { href: "/water", label: "Water Conditions" },
  { href: "/workouts", label: "Workouts" },
  { href: "/food-tent", label: "Food Tent" },
  { href: "/rookie-parent", label: "Rookie Parent" },
  { href: "/payments", label: "Payments" },
  { href: "/apparel", label: "Apparel" },
  { href: "/volunteer", label: "Volunteer Needs" },
  { href: "/photos", label: "Photos" },
  { href: "/messages", label: "Messages" },
  { href: "/polls", label: "Polls" },
  { href: "/boat-maintenance", label: "Boat Maintenance" },
  { href: "/site-maintenance", label: "Site Maintenance" },
  { href: "/coach", label: "Coach" },
  { href: "/schedule", label: "Schedule" },
  { href: "/suggestions", label: "Suggestions" },
  // New buttons go last; Todd reorders them later.
  { href: "/contacts", label: "Who to Ask" },
  { href: "/site", label: "Club Website" },
];

// Per-role home-screen buttons, set from /admin: pick a type of user, then
// which buttons they see. Stored in club_settings "nav_access" as
// { role: [href, ...] }. Until it's saved once, it's worked out from the
// older per-button "nav_visibility" setting above.
export type NavRole = "rower" | "coxswain" | "parent" | "coach" | "admin";
export const NAV_ROLES: { role: NavRole; label: string }[] = [
  { role: "rower", label: "Rower" },
  { role: "coxswain", label: "Coxswain" },
  { role: "parent", label: "Parent" },
  { role: "coach", label: "Coach" },
  { role: "admin", label: "Admin" },
];
export const NAV_ACCESS_KEY = "nav_access";

// Pages that only work for some roles, whatever the setting says.
export const NAV_ROLE_LIMITS: Record<string, NavRole[]> = {
  "/coach": ["coach", "admin"],
};

export function navSectionsFor(role: NavRole): NavSectionDef[] {
  return NAV_SECTIONS.filter((s) => !NAV_ROLE_LIMITS[s.href] || NAV_ROLE_LIMITS[s.href].includes(role));
}

// Who a button is on for before an admin has chosen: everyone unless listed.
export const NAV_DEFAULT_ROLES: Record<string, NavRole[]> = {};

// Saved alongside the per-role lists: every button that existed when they
// were saved, so a button added later starts at its default instead of off.
export const NAV_KNOWN_KEY = "_known";

export function resolveNavAccess(settingsByKey: Map<string, string | null>): Record<NavRole, string[]> {
  let saved: Partial<Record<NavRole | typeof NAV_KNOWN_KEY, unknown>> = {};
  try {
    saved = JSON.parse(settingsByKey.get(NAV_ACCESS_KEY) ?? "{}") ?? {};
  } catch {
    saved = {};
  }
  const visibility = resolveNavVisibility(settingsByKey);
  const legacyAllows = (role: NavRole, href: string) => {
    const v = visibility[href] ?? "everyone";
    if (v === "everyone") return true;
    if (v === "coaches") return role === "coach" || role === "admin";
    if (v === "admins") return role === "admin";
    return false;
  };
  const defaultAllows = (role: NavRole, href: string) =>
    legacyAllows(role, href) && (!NAV_DEFAULT_ROLES[href] || NAV_DEFAULT_ROLES[href].includes(role));
  const known = Array.isArray(saved[NAV_KNOWN_KEY]) ? (saved[NAV_KNOWN_KEY] as unknown[]) : null;

  const access = {} as Record<NavRole, string[]>;
  for (const { role } of NAV_ROLES) {
    const allowed = navSectionsFor(role).map((s) => s.href);
    const list = saved[role];
    access[role] = Array.isArray(list)
      ? allowed.filter(
          (href) => list.includes(href) || (known != null && !known.includes(href) && defaultAllows(role, href))
        )
      : allowed.filter((href) => defaultAllows(role, href));
  }
  return access;
}
