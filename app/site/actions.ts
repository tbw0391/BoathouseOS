"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/clientIp";
import { emailConfigured, sendEmails } from "@/lib/email";
import { getSiteClub } from "@/lib/website";
import { UserError, tryAction } from "@/lib/userError";

const MAX_PER_IP_PER_HOUR = 5;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// The club website's contact and join forms (0112). Public, so it writes with
// the service role, for the club whose address this is, and emails that
// club's admins.
export async function submitInquiry(formData: FormData) {
  return tryAction(async () => {
    // Honeypot: hidden from people, filled in by bots. Fail quietly.
    if (String(formData.get("website") ?? "").trim() !== "") return;

    const club = await getSiteClub();
    if (!club || !club.settings.enabled) throw new UserError("This club's website isn't taking messages right now.");
    const kind = formData.get("kind") === "join" ? "join" : "contact";
    if (!club.settings.sections[kind]) throw new UserError("This form is turned off.");

    const field = (name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max) || null;
    const name = field("name", 120);
    const email = field("email", 200);
    const phone = field("phone", 40);
    const message = field("message", 3000);
    if (!name) throw new UserError("Please enter your name.");
    if (!email && !phone) throw new UserError("Please enter an email or a phone number so the club can reach you.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("That email address doesn't look right.");

    const admin = createAdminClient();
    const ip = await getClientIp();
    const { count } = await admin
      .from("website_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) throw new UserError("Too many messages from this network. Please try again later.");

    const { error } = await admin
      .from("website_inquiries")
      .insert({ club_id: club.id, kind, name, email, phone, message, ip });
    if (error) throw new UserError("Couldn't send your message. Please try again.");

    if (emailConfigured()) {
      const { data: admins } = await admin
        .from("profiles")
        .select("email")
        .eq("club_id", club.id)
        .eq("role", "admin")
        .not("approved_at", "is", null)
        .is("disabled_at", null);
      const to = ((admins as { email: string | null }[] | null) ?? []).map((a) => a.email?.trim()).filter((e): e is string => !!e);
      const what = kind === "join" ? "wants to join" : "sent a message";
      const lines = [
        `${name} ${what} through ${club.name}'s website.`,
        email && `Email: ${email}`,
        phone && `Phone: ${phone}`,
        message && `\n${message}`,
      ].filter(Boolean) as string[];
      const html = `<div style="font-family:system-ui,sans-serif;max-width:520px">${lines
        .map((l) => `<p style="margin:0 0 8px;white-space:pre-line">${escapeHtml(l)}</p>`)
        .join("")}<p style="color:#6b7280;font-size:12px">Also listed in the app under Admin Settings &gt; Website.</p></div>`;
      if (to.length) await sendEmails(to, `${club.name} website: ${name} ${what}`, html, lines.join("\n"));
    }
  });
}
