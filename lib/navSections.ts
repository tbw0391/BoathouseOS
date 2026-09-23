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
  { href: "/lineups", label: "Lineups" },
  { href: "/boats", label: "Boats" },
  { href: "/on-water", label: "On the Water" },
  { href: "/workouts", label: "Workouts" },
  { href: "/food-tent", label: "Food Tent" },
  { href: "/volunteer", label: "Volunteer Needs" },
  { href: "/photos", label: "Photos" },
  { href: "/messages", label: "Messages" },
  { href: "/polls", label: "Polls" },
  { href: "/boat-maintenance", label: "Boat Maintenance" },
  { href: "/site-maintenance", label: "Site Maintenance" },
  { href: "/coach/tracking", label: "Live Tracking" },
  { href: "/schedule", label: "Schedule" },
  { href: "/suggestions", label: "Suggestions" },
];
