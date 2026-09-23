import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The only place in the app allowed to persist the session cookie from a
// password-reset link — Server Components can't set cookies at all (see
// lib/supabase/server.ts), so the code exchange has to happen in a Route
// Handler, not directly on the /reset-password page.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/reset-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/forgot-password?error=This reset link has expired or was already used.`
  );
}
