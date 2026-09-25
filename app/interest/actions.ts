"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/clientIp";

const MAX_LENGTH = 200;
const MAX_SUBMISSIONS_PER_IP_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

// Public: reached from the "interested" QR code without signing in, so this
// writes with the admin client instead of relying on a signed-in session.
export async function submitInterest(formData: FormData) {
  // Honeypot: hidden from people (see InterestForm), filled in by bots.
  // Fail quietly rather than revealing why.
  if (String(formData.get("website") ?? "").trim() !== "") return;

  const field = (name: string) => String(formData.get(name) ?? "").trim().slice(0, MAX_LENGTH) || null;
  const name = field("name");
  const clubName = field("club_name");
  const email = field("email");
  const phone = field("phone");

  if (!email && !phone) {
    throw new Error("Please enter an email or a phone number so we can reach you.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("That email address doesn't look right.");
  }

  const admin = createAdminClient();

  const ip = await getClientIp();
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("interest_signups")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);
  if ((count ?? 0) >= MAX_SUBMISSIONS_PER_IP_PER_HOUR) {
    throw new Error("Too many submissions from this network. Please try again later.");
  }

  const { error } = await admin
    .from("interest_signups")
    .insert({ name, club_name: clubName, email, phone, ip });

  if (error) throw new Error("Couldn't save your details. Please try again.");
}
