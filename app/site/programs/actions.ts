"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/clientIp";
import { getSiteClub } from "@/lib/website";
import { programState, type Program } from "@/lib/programs";
import { checkAnswers, saveRegistration } from "@/lib/programRegistration";
import { UserError, tryAction } from "@/lib/userError";

// Families often sign up more than one child at once.
const MAX_PER_IP_PER_HOUR = 10;

// Registration from the club website (0117). Public, so it writes with the
// service role, for the club whose address this is. Once the program is
// full, people go on the waitlist. Emails the family a confirmation and the
// club's admins a heads-up.
export async function registerForProgram(formData: FormData) {
  return tryAction(async () => {
    // Honeypot: hidden from people, filled in by bots. Pretend it worked.
    if (String(formData.get("website") ?? "").trim() !== "") return { status: "registered" as const };

    const club = await getSiteClub();
    if (!club || !club.settings.enabled || !club.settings.sections.programs) {
      throw new UserError("This club isn't taking registrations online right now.");
    }

    const admin = createAdminClient();
    const { data: programRow } = await admin
      .from("programs")
      .select("*")
      .eq("club_id", club.id)
      .eq("id", String(formData.get("program_id") ?? ""))
      .maybeSingle();
    const program = programRow as Program | null;
    if (!program) throw new UserError("That program isn't there any more.");
    const state = programState(program);
    if (state === "not_yet") throw new UserError("Registration hasn't opened yet.");
    if (state !== "open") throw new UserError("Registration for this program has closed.");

    const field = (name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max) || null;
    const participant = field("participant_name", 120);
    const birthdate = field("participant_birthdate", 10);
    const guardian = field("guardian_name", 120);
    const email = field("email", 200);
    const phone = field("phone", 40);
    const emergencyName = field("emergency_name", 120);
    const emergencyPhone = field("emergency_phone", 40);
    const medical = field("medical_notes", 2000);
    if (!participant) throw new UserError("Please enter the participant's name.");
    if (birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) throw new UserError("That birth date doesn't look right.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("Please enter a working email address.");
    if (!phone) throw new UserError("Please enter a phone number.");
    if (!emergencyName || !emergencyPhone) throw new UserError("Please enter an emergency contact and their phone number.");
    if (program.waiver && formData.get("waiver") !== "on") throw new UserError("Please read and agree to the waiver.");

    const answers = checkAnswers(program, (id) => String(formData.get(`q:${id}`) ?? ""));

    const ip = await getClientIp();
    const { count: recent } = await admin
      .from("program_registrations")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((recent ?? 0) >= MAX_PER_IP_PER_HOUR) throw new UserError("Too many registrations from this network. Please try again later.");

    const status = await saveRegistration(admin, club, program, {
      participant_name: participant,
      participant_birthdate: birthdate,
      guardian_name: guardian,
      email,
      phone,
      emergency_name: emergencyName,
      emergency_phone: emergencyPhone,
      medical_notes: medical,
      answers,
      ip,
    });

    return { status };
  });
}
