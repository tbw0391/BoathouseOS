// Which site this build is. The same code runs two sites:
// - the public demo (boathouseos.app, the default): "Try the demo", the
//   club and profile pickers, the demo reset;
// - production (NEXT_PUBLIC_SITE_MODE=production, deployed from the
//   `production` branch) for real clubs, where none of that exists.
export const IS_DEMO_SITE = process.env.NEXT_PUBLIC_SITE_MODE !== "production";

// Clubs on production are reached at <slug>.boathouseos.app.
export const CLUB_HOST_SUFFIX = ".boathouseos.app";

// The global admin console's own address on production (the demo has it at
// /console). It isn't a club, so no club can take these slugs.
export const CONSOLE_HOST = `admin${CLUB_HOST_SUFFIX}`;
export const RESERVED_SLUGS = ["admin", "www", "api", "app", "demo"];

export function isConsoleHost(host: string | null | undefined): boolean {
  return (host ?? "").toLowerCase().split(":")[0] === CONSOLE_HOST;
}

// Where the console is, from a club's pages.
export const CONSOLE_URL = IS_DEMO_SITE ? "/console" : `https://${CONSOLE_HOST}/console`;

// The club slug in an address like westerville.boathouseos.app, or null.
export function clubSlugFromHost(host: string | null | undefined): string | null {
  const h = (host ?? "").toLowerCase().split(":")[0];
  if (!h.endsWith(CLUB_HOST_SUFFIX)) return null;
  const slug = h.slice(0, -CLUB_HOST_SUFFIX.length);
  return /^[a-z0-9-]+$/.test(slug) && !RESERVED_SLUGS.includes(slug) ? slug : null;
}

// Where a club's members sign in.
export function clubAddress(slug: string): string {
  return IS_DEMO_SITE ? "boathouseos.app" : `${slug}${CLUB_HOST_SUFFIX}`;
}
