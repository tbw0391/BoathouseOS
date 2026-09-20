"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export function Header() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-10 flex items-center justify-center border-b bg-white px-4 py-2">
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
