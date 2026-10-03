"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Waves, Megaphone, Navigation, LogOut, Trophy, type LucideIcon } from "lucide-react";
import { signOut } from "@/app/login/actions";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/lineups", label: "Lineups", icon: Waves },
  { href: "/on-water", label: "On the Water", icon: Navigation },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
];

const TAB_CLASS =
  "flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] leading-tight text-center";

// `liveResultsHref` is set only on a race day (lib/raceDayResults.ts): it
// adds a Live results button next to Home so everyone can check places in
// one tap. Every other day the bar is unchanged.
export function BottomNav({
  userId,
  liveResultsHref = null,
}: {
  userId: string | null;
  liveResultsHref?: string | null;
}) {
  const pathname = usePathname();
  // The pending screen has its own sign-out button and nowhere else to go.
  if (!userId || pathname.startsWith("/pending")) return null;

  const tabs: { href: string; label: string; icon: LucideIcon; live?: boolean }[] = liveResultsHref
    ? [TABS[0], { href: liveResultsHref, label: "Live results", icon: Trophy, live: true }, ...TABS.slice(1)]
    : TABS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-10 border-t bg-white flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((tab) => {
        const path = tab.href.split("?")[0];
        const active = tab.live
          ? pathname === path
          : tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href) && !(liveResultsHref && pathname === liveResultsHref.split("?")[0]);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            className={`${TAB_CLASS} ${
              active
                ? "text-[var(--color-primary)] font-medium"
                : tab.live
                  ? "text-amber-600 font-semibold"
                  : "text-gray-500"
            }`}
          >
            <Icon className="w-6 h-6" />
            {tab.label}
          </Link>
        );
      })}
      <form action={signOut} className="flex-1 flex">
        <button
          type="submit"
          aria-label="Log out"
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-gray-500"
        >
          <LogOut className="w-6 h-6" />
          Log out
        </button>
      </form>
    </nav>
  );
}
