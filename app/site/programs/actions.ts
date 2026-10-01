"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/clientIp";
import { emailConfigured, sendEmails } from "@/lib/email";
import { getSiteClub } from "@/lib/website";
import { formatPrice, parseProgramQuestions, programState, type Program } from "@/lib/programs";
import { UserError, tryAction } from "@/lib/userError";

// Families often sign up more than one child at once.
const MAX_PER_IP_PER_HOUR = 10;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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

    const answers: Record<string, string> = {};
    for (const q of parseProgramQuestions(program.questions)) {
      const value = String(formData.get(`q:${q.id}`) ?? "").trim().slice(0, 2000);
      if (value && q.kind === "choice" && !q.options.includes(value)) throw new UserError(`Pick one of the choices for "${q.label}".`);
      if (value && q.kind === "yes_no" && value !== "Yes" && value !== "No") throw new UserError(`Answer yes or no for "${q.label}".`);
      if (q.required && !value) throw new UserError(`Please answer "${q.label}".`);
      if (value) answers[q.id] = value;
    }

    const ip = await getClientIp();
    const { count: recent } = await admin
      .from("program_registrations")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((recent ?? 0) >= MAX_PER_IP_PER_HOUR) throw new UserError("Too many registrations from this network. Please try again later.");

    let status: "registered" | "waitlist" = "registered";
    if (program.capacity !== null) {
      const { count: taken } = await admin
        .from("program_registrations")
        .select("id", { count: "exact", head: true })
        .eq("program_id", program.id)
        .eq("status", "registered");
      if ((taken ?? 0) >= program.capacity) status = "waitlist";
    }

    const { error } = await admin.from("program_registrations").insert({
      club_id: club.id,
      program_id: program.id,
      status,
      participant_name: participant,
      participant_birthdate: birthdate,
      guardian_name: guardian,
      email,
      phone,
      emergency_name: emergencyName,
      emergency_phone: emergencyPhone,
      medical_notes: medical,
      answers,
      waiver_accepted_at: program.waiver ? new Date().toISOString() : null,
      ip,
    });
    if (error) throw new UserError("Couldn't save the registration. Please try again.");

    if (emailConfigured()) {
      const price = formatPrice(program.price_cents);
      const confirm = [
        status === "waitlist"
          ? `${participant} is on the waitlist for ${program.title} at ${club.name}. The club will contact you if a spot opens up.`
          : `${participant} is registered for ${program.title} at ${club.name}.`,
        price && price !== "Free" && status === "registered" ? `Cost: ${price}. The club will be in touch about payment.` : null,
        `Questions? Contact ${club.name} through its website.`,
      ].filter(Boolean) as string[];
      const html = (lines: string[]) =>
        `<div style="font-family:system-ui,sans-serif;max-width:520px">${lines
          .map((l) => `<p style="margin:0 0 8px;white-space:pre-line">${escapeHtml(l)}</p>`)
          .join("")}</div>`;
      await sendEmails(
        [email],
        `${status === "waitlist" ? "Waitlist" : "Registered"}: ${program.title}`,
        html(confirm),
        confirm.join("\n\n")
      );

      const { data: admins } = await admin
        .from("profiles")
        .select("email")
        .eq("club_id", club.id)
        .eq("role", "admin")
        .not("approved_at", "is", null)
        .is("disabled_at", null);
      const to = ((admins as { email: string | null }[] | null) ?? []).map((a) => a.email?.trim()).filter((e): e is string => !!e);
      const note = [
        `${participant} ${status === "waitlist" ? "joined the waitlist for" : "registered for"} ${program.title}.`,
        `Contact: ${guardian ? `${guardian}, ` : ""}${email}, ${phone}`,
        `See everyone in the app: Admin Settings > Website > Programs.`,
      ];
      if (to.length) await sendEmails(to, `${club.name}: ${participant} ${status === "waitlist" ? "waitlisted for" : "registered for"} ${program.title}`, html(note), note.join("\n"));
    }

    return { status };
  });
}
