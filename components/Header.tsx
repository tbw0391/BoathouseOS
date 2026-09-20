"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Camera } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-10 relative flex items-center justify-center border-b bg-white px-4 py-2">
      <Link
        href="/photos"
        aria-label="Photos"
        className="absolute left-4 inline-flex items-center justify-center text-[#022e5d]"
      >
        <Camera className="w-7 h-7" />
      </Link>
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
