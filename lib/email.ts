import "server-only";

// Alert emails through Resend (resend.com). Needs RESEND_API_KEY and
// EMAIL_FROM (e.g. "BoathouseOS <alerts@boathouseos.app>", on a domain
// verified in Resend); without them nothing is sent.

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function alertEmail(title: string, body: string, link: string) {
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px">
<h2 style="margin:0 0 8px">${escapeHtml(title)}</h2>
<p style="margin:0 0 16px">${escapeHtml(body)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="background:#1f2937;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open BoathouseOS</a></p>
<p style="color:#6b7280;font-size:12px;margin:0">You get this by email because phone alerts aren't turned on for you. Turn them on from the app's home page, or turn off these emails there.</p>
</div>`;
  const text = `${title}\n\n${body}\n\n${link}\n\nYou get this by email because phone alerts aren't turned on for you. Turn them on from the app's home page, or turn off these emails there.`;
  return { html, text };
}

// Sends one email per recipient (no shared To line). Never throws.
export async function sendEmails(
  to: string[],
  subject: string,
  html: string,
  text: string,
  options: { replyTo?: string } = {}
) {
  if (!emailConfigured() || to.length === 0) return;
  try {
    for (let i = 0; i < to.length; i += 100) {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          to.slice(i, i + 100).map((address) => ({
            from: process.env.EMAIL_FROM,
            to: [address],
            subject,
            html,
            text,
            ...(options.replyTo ? { reply_to: options.replyTo } : {}),
          }))
        ),
      });
      if (!res.ok) console.error("Alert email failed", res.status, await res.text());
    }
  } catch (e) {
    console.error("Alert email failed", e);
  }
}
