import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendEmails } from "@/lib/email";
import { groupingKey, shortStack, shouldReport } from "@/lib/errorReportRules";

// Unexpected server errors go to global admins (0100): saved in
// error_reports, grouped by message and page, and emailed when a new one
// shows up or a fixed one comes back (at most one email per error per hour).
// Called from instrumentation.ts. Never throws.

const EMAIL_EVERY_MS = 60 * 60 * 1000;

type Where = { path: string; route: string | null; routeType: string | null };

type ReportRow = {
  id: string;
  count: number;
  last_emailed_at: string | null;
  resolved_at: string | null;
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function reportServerError(err: unknown, where: Where) {
  try {
    if (!shouldReport(err)) return;
    const error = err instanceof Error ? err : new Error(String(err));
    const message = error.message.slice(0, 1000) || "(no message)";
    const digest = (error as { digest?: unknown }).digest;
    const fingerprint = createHash("sha1").update(groupingKey(message, where.route)).digest("hex");
    const now = new Date();

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("error_reports")
      .select("id, count, last_emailed_at, resolved_at")
      .eq("fingerprint", fingerprint)
      .maybeSingle();
    const row = existing as ReportRow | null;

    const latest = {
      message,
      route: where.route,
      route_type: where.routeType,
      // Without the query string: sign-in links carry codes there.
      last_path: where.path.split("?")[0].slice(0, 500),
      last_digest: typeof digest === "string" ? digest : null,
      stack: shortStack(error.stack),
      last_seen: now.toISOString(),
    };

    const cameBack = !!row?.resolved_at;
    const due = !row || cameBack || !row.last_emailed_at || now.getTime() - Date.parse(row.last_emailed_at) >= EMAIL_EVERY_MS;
    const willEmail = due && emailConfigured();

    let count = 1;
    if (row) {
      count = row.count + 1;
      await admin
        .from("error_reports")
        .update({ ...latest, count, resolved_at: null, ...(willEmail ? { last_emailed_at: now.toISOString() } : {}) })
        .eq("id", row.id);
    } else {
      const { error: insertError } = await admin
        .from("error_reports")
        .insert({ ...latest, fingerprint, ...(willEmail ? { last_emailed_at: now.toISOString() } : {}) });
      // Another request saved the same error a moment ago; it'll email.
      if (insertError) return;
    }

    if (willEmail) await emailGlobalAdmins(admin, { ...latest, count, cameBack, isNew: !row });
  } catch (e) {
    console.error("Error report failed", e);
  }
}

async function emailGlobalAdmins(
  admin: ReturnType<typeof createAdminClient>,
  r: { message: string; route: string | null; route_type: string | null; last_path: string; last_digest: string | null; stack: string | null; count: number; cameBack: boolean; isNew: boolean }
) {
  const { data: ids } = await admin.from("global_admins").select("user_id");
  const userIds = ((ids as { user_id: string }[] | null) ?? []).map((g) => g.user_id);
  if (userIds.length === 0) return;
  const { data: people } = await admin.from("profiles").select("email").in("id", userIds);
  const emails = ((people as { email: string | null }[] | null) ?? [])
    .map((p) => p.email?.trim())
    .filter((e): e is string => !!e);
  if (emails.length === 0) return;

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.boathouseos.app";
  const link = `${site}/global-admin/errors`;
  const status = r.isNew ? "New error" : r.cameBack ? "Error is back after being marked fixed" : `Still happening (${r.count} times)`;
  const where = `${r.route ?? r.last_path}${r.route_type ? ` (${r.route_type})` : ""}`;
  const subject = `BoathouseOS error: ${r.message.slice(0, 80)}`;

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px">
<p style="margin:0 0 4px;color:#6b7280;font-size:13px">${escapeHtml(status)}</p>
<h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(r.message)}</h2>
<p style="margin:0 0 4px;font-size:14px"><strong>Where:</strong> ${escapeHtml(where)}</p>
<p style="margin:0 0 4px;font-size:14px"><strong>Page:</strong> ${escapeHtml(r.last_path)}</p>
${r.last_digest ? `<p style="margin:0 0 4px;font-size:14px"><strong>Digest:</strong> ${escapeHtml(r.last_digest)}</p>` : ""}
${r.stack ? `<pre style="background:#f3f4f6;padding:8px;font-size:12px;white-space:pre-wrap;margin:12px 0">${escapeHtml(r.stack)}</pre>` : ""}
<p style="margin:16px 0"><a href="${escapeHtml(link)}" style="background:#1f2937;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">See all errors</a></p>
<p style="color:#6b7280;font-size:12px;margin:0">You get these because you're a BoathouseOS global admin. At most one email per error per hour.</p>
</div>`;
  const text = `${status}\n\n${r.message}\n\nWhere: ${where}\nPage: ${r.last_path}${r.last_digest ? `\nDigest: ${r.last_digest}` : ""}${r.stack ? `\n\n${r.stack}` : ""}\n\n${link}`;
  await sendEmails(emails, subject, html, text);
}
