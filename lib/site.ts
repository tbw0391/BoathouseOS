// Which site this build is. The same code runs two sites:
// - the public demo (boathouseos.app, the default): "Try the demo", the
//   club and profile pickers, the demo reset;
// - production (NEXT_PUBLIC_SITE_MODE=production, deployed from the
//   `production` branch) for real clubs, where none of that exists.
export const IS_DEMO_SITE = process.env.NEXT_PUBLIC_SITE_MODE !== "production";

// Clubs on production are reached at <slug>.boathouseos.app.
export const CLUB_HOST_SUFFIX = ".boathouseos.app";

// The club slug in an address like westerville.boathouseos.app, or null.
export function clubSlugFromHost(host: string | null | undefined): string | null {
  const h = (host ?? "").toLowerCase().split(":")[0];
  if (!h.endsWith(CLUB_HOST_SUFFIX)) return null;
  const slug = h.slice(0, -CLUB_HOST_SUFFIX.length);
  return /^[a-z0-9-]+$/.test(slug) && slug !== "www" ? slug : null;
}
