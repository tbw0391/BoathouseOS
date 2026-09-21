export interface NavSectionDef {
  href: string;
  label: string;
}

// Every home-page tile an admin can hide via /admin. "/todo" (the internal
// backlog view) is intentionally excluded — it's a dev tool, not a
// team-facing feature.
export const NAV_SECTIONS: NavSectionDef[] = [
  { href: "/roster", label: "Roster" },
  { href: "/schedule", label: "Schedule" },
  { href: "/lineups", label: "Lineups" },
  { href: "/on-water", label: "On the Water" },
  { href: "/workouts", label: "Workouts" },
  { href: "/food-tent", label: "Food Tent" },
  { href: "/volunteer", label: "Volunteer Needs" },
  { href: "/photos", label: "Photos" },
  { href: "/messages", label: "Messages" },
  { href: "/polls", label: "Polls" },
  { href: "/suggestions", label: "Suggestions" },
  { href: "/boat-maintenance", label: "Boat Maintenance" },
  { href: "/site-maintenance", label: "Site Maintenance" },
  { href: "/coach/tracking", label: "Live Tracking" },
];
