import "server-only";

export interface UrlMeta {
  title: string | null;
  iconUrl: string | null;
}

const FETCH_TIMEOUT_MS = 8000;

function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

// Prefers apple-touch-icon (a real logo-sized image) over a generic
// favicon.ico (often a tiny, low-res glyph) — order of <link> tags in the
// document doesn't tell us which is "better", so we scan all of them.
function extractIconHref(html: string): string | null {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  let appleHref: string | null = null;
  let iconHref: string | null = null;
  for (const tag of linkTags) {
    const relMatch = tag.match(/rel=["']([^"']+)["']/i);
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (!relMatch || !hrefMatch) continue;
    const rel = relMatch[1].toLowerCase();
    if (rel.includes("apple-touch-icon")) appleHref ??= hrefMatch[1];
    else if (rel === "icon" || rel === "shortcut icon") iconHref ??= hrefMatch[1];
  }
  return appleHref ?? iconHref;
}

// Best-effort <title>/favicon scrape for "Add regatta from a link" when the
// pasted URL isn't a recognized timing provider (e.g. a regatta's own
// homepage) — just enough to prefill a title and an icon so the coach isn't
// starting from a blank form, nothing structured like a schedule.
export async function fetchUrlMeta(pageUrl: string): Promise<UrlMeta> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(pageUrl, { signal: controller.signal, redirect: "follow" });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return { title: null, iconUrl: null };

    const html = await res.text();
    const finalUrl = res.url || pageUrl;

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") || null : null;

    const iconHref = extractIconHref(html);
    let iconUrl = iconHref ? resolveUrl(iconHref, finalUrl) : null;

    if (!iconUrl) {
      const fallback = resolveUrl("/favicon.ico", finalUrl);
      if (fallback) {
        try {
          const headRes = await fetch(fallback, { method: "HEAD" });
          if (headRes.ok) iconUrl = fallback;
        } catch {
          // No favicon.ico either — leave null, the event just won't get an icon.
        }
      }
    }

    return { title, iconUrl };
  } catch {
    return { title: null, iconUrl: null };
  }
}
