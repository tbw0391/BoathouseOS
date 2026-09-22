"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Waves, Megaphone, type LucideIcon } from "lucide-react";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/lineups", label: "Lineups", icon: Waves },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
];

export function BottomNav({ userId }: { userId: string | null }) {
  const pathname = usePathname();
  if (!userId) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-10 border-t bg-white flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${
              active ? "text-[#022e5d] font-medium" : "text-gray-500"
            }`}
          >
            <Icon className="w-6 h-6" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
