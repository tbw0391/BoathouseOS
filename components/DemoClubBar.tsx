"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Slim club bar across the top of every page for demo visitors who picked
// their club. Home shows its own large blade instead.
export function DemoClubBar({ name, blade }: { name: string; blade: string | null }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/choose-club") || pathname.startsWith("/login")) {
    return null;
  }

  return (
    <Link
      href="/"
      className="flex items-center gap-2 px-4 py-2 border-b bg-white"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      {blade && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={blade} alt="" width={44} height={24} className="shrink-0" />
      )}
      <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-primary)]">
        {name}
      </span>
    </Link>
  );
}
