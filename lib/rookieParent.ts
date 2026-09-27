// Sections of the Rookie Parent page. Each one's text lives in club_settings
// under its key and is written by admins on the page itself.
export const ROOKIE_PARENT_SECTIONS = [
  { key: "rookie_parent_faq", anchor: "faq", title: "FAQ" },
  { key: "rookie_parent_what_to_bring", anchor: "what-to-bring", title: "What to Bring" },
  {
    key: "rookie_parent_locations",
    anchor: "locations",
    title: "Food Tent, Parking & Team Tent",
  },
] as const;

export type RookieParentKey = (typeof ROOKIE_PARENT_SECTIONS)[number]["key"];
