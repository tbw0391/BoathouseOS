"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Camera, MessageCircle } from "lucide-react";

export function Header({ unreadCount }: { unreadCount: number | null }) {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-10 relative flex items-center justify-center border-b bg-white px-4 py-2">
      <div className="absolute left-4 flex items-center gap-4">
        <Link href="/photos" aria-label="Photos" className="inline-flex items-center justify-center text-[#022e5d]">
          <Camera className="w-7 h-7" />
        </Link>
        {unreadCount !== null && (
          <Link
            href="/messages"
            aria-label="Messages"
            className="relative inline-flex items-center justify-center text-[#022e5d]"
          >
            <MessageCircle className="w-7 h-7" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px]">
                {unreadCount}
              </span>
            )}
          </Link>
        )}
      </div>
      <Link href="/" aria-label="Home" className="inline-flex">
        <Image
          src="/icons/icon-512.png"
          alt="Westerville Crew home"
          width={512}
          height={512}
          priority
          className="w-14 h-14"
        />
      </Link>
    </header>
  );
}
