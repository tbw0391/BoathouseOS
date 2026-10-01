import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteClub, type SiteClub, type WebsiteSection } from "@/lib/website";

// The club website's frame: the club's name and icon, its sections and
// pages, and "Member sign in". A site that isn't turned on sends visitors to
// sign in; the club's admins can still preview it.
export async function loadSite(section?: WebsiteSection): Promise<{ club: SiteClub; preview: boolean }> {
  const club = await getSiteClub();
  if (!club) redirect("/login");
  let preview = false;
  if (!club.settings.enabled) {
    const supabase = await createClient();
    const { data: isAdmin } = await supabase.rpc("is_club_admin");
    if (!isAdmin) redirect("/login");
    preview = true;
  }
  if (section && !club.settings.sections[section]) redirect("/site");
  return { club, preview };
}

const NAV: { key: WebsiteSection; href: string; label: string }[] = [
  { key: "schedule", href: "/site/schedule", label: "Schedule" },
  { key: "results", href: "/site/results", label: "Results" },
  { key: "coaches", href: "/site/coaches", label: "Coaches" },
  { key: "news", href: "/site/news", label: "News" },
  { key: "contact", href: "/site/contact", label: "Contact" },
];

export function SiteShell({ club, preview, children }: { club: SiteClub; preview: boolean; children: React.ReactNode }) {
  const s = club.settings.sections;
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {preview && (
        <p className="bg-amber-100 text-amber-900 text-xs text-center px-4 py-1.5">
          Preview: only your club&apos;s admins can see this until the website is turned on (Admin Settings &gt; Website).
        </p>
      )}
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link href="/site" className="flex items-center gap-2 min-w-0">
            {club.iconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={club.iconUrl} alt="" width={40} height={40} className="w-10 h-10 rounded-lg" />
            )}
            <span className="font-bold text-lg text-[var(--color-primary)] truncate">{club.name}</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {NAV.filter((n) => s[n.key]).map((n) => (
              <Link key={n.href} href={n.href} className="hover:underline">
                {n.label}
              </Link>
            ))}
            {menuItems(club.pages).map((item) =>
              item.kind === "page" ? (
                <Link key={item.slug} href={`/site/p/${item.slug}`} className="hover:underline">
                  {item.title}
                </Link>
              ) : (
                <details key={item.group} className="relative group">
                  <summary className="cursor-pointer list-none hover:underline">{item.group} ▾</summary>
                  <div className="absolute z-20 mt-2 min-w-48 rounded-lg border bg-white shadow-lg py-1 flex flex-col">
                    {item.pages.map((p) => (
                      <Link key={p.slug} href={`/site/p/${p.slug}`} className="px-3 py-1.5 hover:bg-gray-50 whitespace-nowrap">
                        {p.title}
                      </Link>
                    ))}
                  </div>
                </details>
              )
            )}
            {club.storeUrl && (
              <a href={club.storeUrl} target="_blank" rel="noreferrer" className="hover:underline">
                Store
              </a>
            )}
            {s.join && (
              <Link href="/site/join" className="rounded-lg bg-[var(--color-primary)] text-white px-3 py-1.5 font-medium">
                Join us
              </Link>
            )}
            <Link href="/login" className="rounded-lg border-2 border-[var(--color-primary)] text-[var(--color-primary)] px-3 py-1 font-medium">
              Member sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

type MenuPage = SiteClub["pages"][number];
type MenuItem = ({ kind: "page" } & MenuPage) | { kind: "group"; group: string; pages: MenuPage[] };

// Pages in their order, with pages that share a menu group gathered under one
// drop-down where the group's first page would be.
function menuItems(pages: MenuPage[]): MenuItem[] {
  const items: MenuItem[] = [];
  for (const p of pages) {
    if (!p.menu_group) {
      items.push({ kind: "page", ...p });
      continue;
    }
    const existing = items.find((i) => i.kind === "group" && i.group === p.menu_group);
    if (existing && existing.kind === "group") existing.pages.push(p);
    else items.push({ kind: "group", group: p.menu_group, pages: [p] });
  }
  return items;
}

export function when(iso: string, ends?: string | null) {
  const opts = { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" } as const;
  const start = new Date(iso).toLocaleDateString("en-US", opts);
  if (!ends) return start;
  const end = new Date(ends).toLocaleDateString("en-US", opts);
  return end === start ? start : `${start} – ${end}`;
}
