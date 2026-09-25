"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const MAX_LENGTH = 200;

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
  const { error } = await admin
    .from("interest_signups")
    .insert({ name, club_name: clubName, email, phone });

  if (error) throw new Error("Couldn't save your details. Please try again.");
}
