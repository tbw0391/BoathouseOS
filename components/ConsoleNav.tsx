"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/console", label: "Overview" },
  { href: "/console/clubs", label: "Clubs" },
  { href: "/console/members", label: "Members" },
  { href: "/console/health", label: "Site health" },
  { href: "/console/announcements", label: "Announcements" },
  { href: "/console/admins", label: "Global admins" },
];

export function ConsoleNav() {
  const pathname = usePathname();
  return (
    <nav className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto text-sm">
      {SECTIONS.map((s) => {
        const active = s.href === "/console" ? pathname === "/console" : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`shrink-0 px-3 py-2 border-b-2 ${active ? "border-white font-medium" : "border-transparent text-white/70 hover:text-white"}`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
