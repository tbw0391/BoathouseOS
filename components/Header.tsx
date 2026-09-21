import Link from "next/link";
import Image from "next/image";
import { Camera, MessageCircle, CircleUserRound, Music } from "lucide-react";

export function Header({
  unreadCount,
  userId,
  photoUrl,
}: {
  unreadCount: number | null;
  userId: string | null;
  photoUrl: string | null;
}) {
  return (
    <header className="sticky top-0 z-10 relative flex items-center justify-center border-b bg-white px-4 py-2">
      <div className="absolute left-4 flex items-center gap-4">
        <Link href="/photos" aria-label="Photos" className="inline-flex items-center justify-center text-[#022e5d]">
          <Camera className="w-7 h-7" />
        </Link>
        <Link href="/walk-up-songs" aria-label="Walk up songs" className="inline-flex items-center justify-center text-[#022e5d]">
          <Music className="w-7 h-7" />
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
      {userId && (
        <div className="absolute right-4 flex items-center">
          <Link href={`/roster/${userId}`} aria-label="My profile" className="inline-flex items-center justify-center">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover border"
              />
            ) : (
              <CircleUserRound className="w-8 h-8 text-[#022e5d]" />
            )}
          </Link>
        </div>
      )}
    </header>
  );
}
