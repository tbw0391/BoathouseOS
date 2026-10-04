"use server";

import { fullBirthdate } from "@/lib/birthday";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAnswers, saveRegistration } from "@/lib/programRegistration";
import { medicalSummary, primaryEmergencyContact } from "@/lib/emergencyInfo";
import { programState, type Program } from "@/lib/programs";
import type { EmergencyInfo } from "@/lib/database.types";
import { UserError, tryAction } from "@/lib/userError";

// Members signing up for programs in the app (0120): themselves, or a rower
// they're a parent/guardian of. Everything but the program's own questions
// comes from the app: names, birthday, the parent's contact details, and the
// rower's emergency contact and medical notes.

async function canRegister(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, profileId: string) {
  if (profileId === userId) return true;
  const { data } = await supabase
    .from("family_links")
    .select("rower_id")
    .eq("guardian_id", userId)
    .eq("rower_id", profileId)
    .maybeSingle();
  return !!data;
}

export async function registerMember(programId: string, profileId: string, raw: Record<string, string>, waiverAgreed: boolean) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");
    if (!(await canRegister(supabase, user.id, profileId))) {
      throw new UserError("You can only sign up yourself or a rower you're a parent or guardian of.");
    }

    const admin = createAdminClient();
    const [{ data: programRow }, { data: people }, { data: infoRow }] = await Promise.all([
      supabase.from("programs").select("*").eq("id", programId).maybeSingle(),
      admin.from("profiles").select("id, club_id, display_name, birthday, email, phone").in("id", [user.id, profileId]),
      admin.from("emergency_info").select("*").eq("profile_id", profileId).maybeSingle(),
    ]);
    const program = programRow as Program | null;
    if (!program) throw new UserError("That program isn't there any more.");
    const state = programState(program);
    if (state === "not_yet") throw new UserError("Registration hasn't opened yet.");
    if (state !== "open") throw new UserError("Registration for this program has closed.");
    if (program.waiver && !waiverAgreed) throw new UserError("Please read and agree to the waiver.");

    type Person = { id: string; club_id: string; display_name: string; birthday: string | null; email: string | null; phone: string | null };
    const byId = new Map(((people as Person[] | null) ?? []).map((p) => [p.id, p]));
    const me = byId.get(user.id);
    const participant = byId.get(profileId);
    if (!me || !participant || participant.club_id !== program.club_id) throw new UserError("Couldn't find that member.");

    const info = infoRow as EmergencyInfo | null;
    const contact = primaryEmergencyContact(info);
    if (!contact) {
      throw new UserError(
        `Add an emergency contact with a phone number on ${profileId === user.id ? "your" : `${participant.display_name}'s`} profile first.`
      );
    }
    const email = me.email?.trim();
    if (!email) throw new UserError("Add an email address to your profile first.");

    const { data: clubRow } = await admin.from("clubs").select("id, name").eq("id", program.club_id).single();
    const club = clubRow as { id: string; name: string };

    const status = await saveRegistration(admin, club, program, {
      participant_name: participant.display_name,
      participant_birthdate: fullBirthdate(participant.birthday),
      guardian_name: profileId === user.id ? null : me.display_name,
      email,
      phone: me.phone,
      emergency_name: contact.name,
      emergency_phone: contact.phone,
      medical_notes: medicalSummary(info),
      answers: checkAnswers(program, (id) => String(raw?.[id] ?? "")),
      profile_id: profileId,
      registered_by: user.id,
    });

    revalidatePath("/programs");
    revalidatePath("/admin/website/programs", "layout");
    return { status };
  });
}

// A family taking back a registration. The spot isn't handed on
// automatically; admins give waitlisted people a spot.
export async function cancelMemberRegistration(registrationId: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");
    // Readable only to the member's family, coaches and admins (0120).
    const { data } = await supabase
      .from("program_registrations")
      .select("id, profile_id, status")
      .eq("id", registrationId)
      .maybeSingle();
    const reg = data as { id: string; profile_id: string | null; status: string } | null;
    if (!reg?.profile_id || !(await canRegister(supabase, user.id, reg.profile_id))) {
      throw new UserError("You can't change that registration.");
    }
    const { error } = await createAdminClient()
      .from("program_registrations")
      .update({ status: "cancelled" })
      .eq("id", registrationId);
    if (error) throw new Error(error.message);
    revalidatePath("/programs");
    revalidatePath("/admin/website/programs", "layout");
  });
}
