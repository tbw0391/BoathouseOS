"use server";

import { createClient } from "@/lib/supabase/server";

const MAX_LENGTH = 200;

export async function submitInterest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

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

  const { error } = await supabase
    .from("interest_signups")
    .insert({ name, club_name: clubName, email, phone });

  if (error) throw new Error(error.message);
}
