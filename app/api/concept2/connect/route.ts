import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { concept2AuthorizeUrl, concept2Configured } from "@/lib/concept2";

const C2_COOKIE = "c2_connect";

// "Connect Concept2" on Workouts: checks the signed-in member may act for
// this rower, remembers who it's for in a short-lived cookie, and sends
// them to Concept2 to sign in and allow read access.
export async function GET(request: NextRequest) {
  const who = request.nextUrl.searchParams.get("who") ?? "";
  const back = new URL(`/workouts${who ? `?who=${encodeURIComponent(who)}` : ""}`, request.url);
  if (!concept2Configured() || !who) return NextResponse.redirect(back);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const { data: ok } = await supabase.rpc("can_act_for", { person: who });
  if (!ok) return NextResponse.redirect(back);

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(concept2AuthorizeUrl(state));
  res.cookies.set(C2_COOKIE, `${state}.${who}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/concept2",
    maxAge: 10 * 60,
  });
  return res;
}
