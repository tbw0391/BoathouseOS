import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Set-your-password links an admin hands a new member from Roster → Add
// member (2026-10-03): the login is created already confirmed, and this
// link signs them in once so /reset-password can set their password. Like
// /auth/callback, it has to be a Route Handler to set the session cookie.
const ALLOWED_TYPES: EmailOtpType[] = ["recovery", "invite", "magiclink"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextRaw = searchParams.get("next") ?? "/reset-password";
  // Only ever send people somewhere on this site.
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/reset-password";

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    `${origin}/forgot-password?error=This link has expired or was already used. Enter your email to get a new one.`
  );
}
