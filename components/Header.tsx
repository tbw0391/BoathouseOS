"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Camera,
  MessageCircle,
  CircleUserRound,
  Music,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import { signOut } from "@/app/login/actions";

export function Header({
  unreadCount,
  userId,
  photoUrl,
  clubBlade,
}: {
  unreadCount: number | null;
  userId: string | null;
  photoUrl: string | null;
  // A demo visitor's chosen club blade; home shows it large instead.
  clubBlade: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 border-b bg-white">
      <div className="relative flex items-center justify-center px-4 py-2">
        <div className="absolute left-4 flex items-center gap-4">
          <Link
            href="/photos"
            aria-label="Photos"
            className="inline-flex items-center justify-center text-[var(--color-primary)]"
          >
            <Camera className="w-7 h-7" />
          </Link>
          <Link
            href="/walk-up-songs"
            aria-label="Walk up songs"
            className="inline-flex items-center justify-center text-[var(--color-primary)]"
          >
            <Music className="w-7 h-7" />
          </Link>
          {unreadCount !== null && (
            <Link
              href="/messages"
              aria-label="Messages"
              className="relative inline-flex items-center justify-center text-[var(--color-primary)]"
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
          {clubBlade && pathname !== "/" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clubBlade}
              alt="Home"
              width={99}
              height={54}
              className="h-14 w-auto"
            />
          ) : (
            <Image
              src="/icons/icon-512.png"
              alt="Home"
              width={512}
              height={512}
              priority
              className="w-14 h-14"
            />
          )}
        </Link>
        {userId && (
          <div className="absolute right-4 flex items-center gap-4">
            <Link
              href={`/roster/${userId}`}
              aria-label="My profile"
              className="inline-flex items-center justify-center"
            >
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover border"
                />
              ) : (
                <CircleUserRound className="w-8 h-8 text-[var(--color-primary)]" />
              )}
            </Link>
            <form action={signOut} className="inline-flex">
              <button
                type="submit"
                aria-label="Log out"
                className="inline-flex text-[var(--color-primary)]"
              >
                <LogOut className="w-7 h-7" />
              </button>
            </form>
          </div>
        )}
      </div>
      {pathname !== "/" && (
        <div className="border-t px-4 py-1.5">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      )}
    </header>
  );
}
