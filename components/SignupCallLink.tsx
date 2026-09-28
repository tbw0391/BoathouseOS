"use client";

import Link from "next/link";
import { SIGNUP_CALL_SEEN_COOKIE, parseSignupCallSeen } from "@/lib/signupCallSeen";

// A "signups are open" banner button: remembers the click so the home page
// stops showing that event's banner.

export function SignupCallLink({
  href,
  eventId,
  className,
  children,
}: {
  href: string;
  eventId: string;
  className?: string;
  children: React.ReactNode;
}) {
  function remember() {
    const match = document.cookie.match(new RegExp(`(?:^|; )${SIGNUP_CALL_SEEN_COOKIE}=([^;]*)`));
    const seen = parseSignupCallSeen(match?.[1]);
    const next = [...seen.filter((id) => id !== eventId), eventId].slice(-20);
    document.cookie = `${SIGNUP_CALL_SEEN_COOKIE}=${encodeURIComponent(next.join(","))}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
  }

  return (
    <Link href={href} onClick={remember} className={className}>
      {children}
    </Link>
  );
}
