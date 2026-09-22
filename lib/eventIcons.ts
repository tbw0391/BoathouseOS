// Custom icons for specific named regattas, matched by keyword against the
// schedule event's title (same pattern as the food-item emoji matching on
// the home page). Add more entries here as other regattas get their own
// logo.
const EVENT_ICON_RULES: { keywords: string[]; url: string }[] = [
  { keywords: ["cuyahoga", "hotc"], url: "/regatta-icons/hotc.png" },
];

export function getEventIconUrl(title: string): string | null {
  const lower = title.toLowerCase();
  for (const rule of EVENT_ICON_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.url;
  }
  return null;
}
