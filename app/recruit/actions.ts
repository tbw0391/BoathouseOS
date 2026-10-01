"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/clientIp";
import { escapeHtml, sendEmails } from "@/lib/email";
import { consolePageUrl, globalAdminEmails } from "@/lib/globalAdmins";
import { isAdult } from "@/lib/recruiting";
import { listedAthletes, requireApprovedRecruiter } from "@/lib/recruitServer";
import { temporaryPassword } from "@/lib/console";
import { isDemoEmail } from "@/lib/demoAccount";
import { UserError, tryAction } from "@/lib/userError";

const MAX_SIGNUPS_PER_IP_PER_HOUR = 5;
const MAX_CONTACTS_PER_DAY = 20;

// A college coach signs up. The account gets a random password; the page
// then sends a "set your password" email, so only someone who reads that
// .edu inbox can sign in. A global admin approves them before they see
// any athletes.
export async function recruiterSignUp(formData: FormData) {
  return tryAction(async () => {
    // Honeypot, as on /signup.
    if (String(formData.get("middle_name") ?? "").trim() !== "") {
      throw new UserError("Something went wrong. Please try again.");
    }
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const school = String(formData.get("school") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    if (!name || !email || !school) throw new UserError("Your name, school and school email are required.");
    if (name.length > 100 || school.length > 150 || title.length > 100) throw new UserError("That's too long.");
    if (!/^[^\s@]+@[^\s@]+\.edu$/.test(email)) {
      throw new UserError("Use your school's .edu email address.");
    }
    if (formData.get("agree_terms") !== "on") {
      throw new UserError("Please agree to the Terms of Service and Privacy Policy.");
    }

    const admin = createAdminClient();
    const ip = await getClientIp();
    const { count } = await admin
      .from("signup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((count ?? 0) >= MAX_SIGNUPS_PER_IP_PER_HOUR) {
      throw new UserError("Too many signup attempts from this network. Please try again later.");
    }
    await admin.from("signup_attempts").insert({ ip });

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword() + temporaryPassword(),
      email_confirm: true,
    });
    if (createError || !created.user) {
      throw new UserError("That email already has an account. Sign in, or use \"Forgot password?\" to set a new one.");
    }
    const { error } = await admin
      .from("recruiters")
      .insert({ user_id: created.user.id, name, email, school, title: title || null });
    if (error) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(error.message);
    }

    const link = consolePageUrl("/console/recruiters");
    await sendEmails(
      await globalAdminEmails(admin),
      `College coach to approve: ${name}, ${school}`,
      `<p>${escapeHtml(name)}${title ? `, ${escapeHtml(title)}` : ""} at ${escapeHtml(school)} (${escapeHtml(email)}) signed up for college recruiting.</p><p><a href="${escapeHtml(link)}">Approve or turn them down</a></p>`,
      `${name}${title ? `, ${title}` : ""} at ${school} (${email}) signed up for college recruiting.\n\nApprove or turn them down: ${link}`
    );
    return { email };
  });
}

// A college coach's message about an athlete. It goes by email to the
// athlete's club coaches and parents (and the athlete, if 18 or over), with
// replies going straight back to the college coach.
export async function contactAthlete(formData: FormData) {
  return tryAction(async () => {
    const me = await requireApprovedRecruiter();
    const athleteId = String(formData.get("athlete_id") ?? "");
    const message = String(formData.get("message") ?? "").trim();
    if (!message) throw new UserError("Write a message first.");
    if (message.length > 4000) throw new UserError("Keep the message under 4,000 characters.");

    const admin = createAdminClient();
    const [athlete] = await listedAthletes(admin, athleteId);
    if (!athlete) throw new UserError("This athlete isn't listed anymore.");

    const { count } = await admin
      .from("recruit_contacts")
      .select("id", { count: "exact", head: true })
      .eq("recruiter_id", me.user_id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if ((count ?? 0) >= MAX_CONTACTS_PER_DAY) {
      throw new UserError(`You can contact up to ${MAX_CONTACTS_PER_DAY} athletes a day.`);
    }

    const { error } = await admin
      .from("recruit_contacts")
      .insert({ club_id: athlete.clubId, profile_id: athlete.id, recruiter_id: me.user_id, message });
    if (error) throw new Error(error.message);

    // Who hears about it: the club's coaches (its admins if it has none),
    // the athlete's parents, and the athlete if they're an adult.
    const [{ data: staffRows }, { data: linkRows }, { data: athleteRow }] = await Promise.all([
      admin
        .from("profiles")
        .select("email, role")
        .eq("club_id", athlete.clubId)
        .in("role", ["coach", "admin"])
        .not("approved_at", "is", null)
        .is("disabled_at", null),
      admin.from("family_links").select("guardian_id").eq("rower_id", athlete.id),
      admin.from("profiles").select("email, birthday").eq("id", athlete.id).single(),
    ]);
    const staff = (staffRows as { email: string | null; role: string }[] | null) ?? [];
    const coaches = staff.filter((s) => s.role === "coach");
    const guardianIds = ((linkRows as { guardian_id: string }[] | null) ?? []).map((l) => l.guardian_id);
    const { data: guardianRows } = guardianIds.length
      ? await admin.from("profiles").select("email").in("id", guardianIds).is("disabled_at", null)
      : { data: [] };
    const a = athleteRow as { email: string | null; birthday: string | null } | null;
    const to = [
      ...(coaches.length ? coaches : staff).map((s) => s.email),
      ...((guardianRows as { email: string | null }[] | null) ?? []).map((g) => g.email),
      ...(a && isAdult(a.birthday) ? [a.email] : []),
    ]
      .map((e) => e?.trim().toLowerCase())
      .filter((e): e is string => !!e && !isDemoEmail(e));

    const from = `${me.name}${me.title ? `, ${me.title}` : ""}, ${me.school}`;
    const subject = `College recruiting: ${me.school} is interested in ${athlete.name}`;
    const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px">
<p style="margin:0 0 12px"><strong>${escapeHtml(from)}</strong> (${escapeHtml(me.email)}) sent this about <strong>${escapeHtml(athlete.name)}</strong> through BoathouseOS college recruiting:</p>
<blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #d1d5db;white-space:pre-wrap">${escapeHtml(message)}</blockquote>
<p style="margin:0 0 12px">Reply to this email to answer them directly.</p>
<p style="color:#6b7280;font-size:12px;margin:0">You get this as ${escapeHtml(athlete.name)}'s club coach, parent or guardian, or because ${escapeHtml(athlete.name)} is listed for college coaches. BoathouseOS checked this coach's school email and approved them, but check before sharing anything personal. The athlete or a parent can stop the listing from their profile.</p>
</div>`;
    const text = `${from} (${me.email}) sent this about ${athlete.name} through BoathouseOS college recruiting:\n\n${message}\n\nReply to this email to answer them directly.\n\nBoathouseOS checked this coach's school email and approved them, but check before sharing anything personal. The athlete or a parent can stop the listing from their profile.`;
    await sendEmails([...new Set(to)], subject, html, text, { replyTo: me.email });
    revalidatePath(`/recruit/${athlete.id}`);
  });
}
