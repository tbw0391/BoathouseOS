import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { connectConcept2 } from "@/lib/concept2";

const C2_COOKIE = "c2_connect";

function same(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Concept2 sends the member back here after they allow access. Only
// accepted from the member who just tapped Connect (the cookie from
// /api/concept2/connect, 10 minutes); the state value is checked too when
// Concept2 sends it back.
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(C2_COOKIE)?.value ?? "";
  const [state, who] = cookie.split(".");
  const done = (result: string) => {
    const url = new URL("/workouts", request.url);
    if (who) url.searchParams.set("who", who);
    url.searchParams.set("c2", result);
    const res = NextResponse.redirect(url);
    res.cookies.set(C2_COOKIE, "", { path: "/api/concept2", maxAge: 0 });
    return res;
  };

  const code = request.nextUrl.searchParams.get("code");
  const givenState = request.nextUrl.searchParams.get("state");
  if (!state || !who) return done("expired");
  if (!code) return done("cancelled");
  if (givenState !== null && !same(givenState, state)) return done("expired");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const { data: ok } = await supabase.rpc("can_act_for", { person: who });
  if (!ok) return done("error");

  try {
    await connectConcept2(who, code, user.id);
    return done("connected");
  } catch (e) {
    console.error("Concept2 connect failed", e);
    return done("error");
  }
}
