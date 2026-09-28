import "server-only";
import { cookies } from "next/headers";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ALERT_SETTINGS_KEY, EMAIL_BACKUP_KINDS, parseAlertSettings, type AlertKind } from "@/lib/alertSettings";
import { alertEmail, emailConfigured, sendEmails } from "@/lib/email";
import { isDemoEmail } from "@/lib/demoAccount";

// Phone/browser push alerts. Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY and
// VAPID_PRIVATE_KEY (generate a pair with `npx web-push generate-vapid-keys`);
// without them sending is a no-op and the "Turn on alerts" prompt stays hidden.

export const PUSH_ENDPOINT_COOKIE = "push_endpoint";

// Browsers only hand out endpoints on these push services. Anything else is
// refused, so a member can't point our server's outgoing alert requests at
// some other site.
const PUSH_SERVICE_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /\.push\.apple\.com$/,
  /\.notify\.windows\.com$/,
];

export function isPushServiceEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && PUSH_SERVICE_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

export interface PushMessage {
  // Which admin on/off switch covers this alert (see lib/alertSettings.ts).
  kind: AlertKind;
  title: string;
  body: string;
  // Where tapping the notification opens.
  url: string;
  // Notifications with the same tag replace each other instead of stacking.
  tag?: string;
}

function configure(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:privacy@boathouseos.app",
    publicKey,
    privateKey
  );
  return true;
}

// Sends to every device these people turned alerts on for, and emails the
// important kinds to anyone with no device (see EMAIL_BACKUP_KINDS). Never
// throws: alerts are a nice-to-have on top of whatever action triggered them.
export async function sendPush(userIds: string[], message: PushMessage) {
  try {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return;

    const admin = createAdminClient();
    const { data: setting } = await admin
      .from("club_settings")
      .select("value")
      .eq("key", ALERT_SETTINGS_KEY)
      .maybeSingle();
    if (!parseAlertSettings((setting as { value: string | null } | null)?.value)[message.kind]) return;

    const { data } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", ids);
    const subs = ((data as { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }[] | null) ?? []).filter(
      (s) => isPushServiceEndpoint(s.endpoint)
    );

    const { title, body, url, tag } = message;
    if (subs.length > 0 && configure()) {
      const payload = JSON.stringify({ title, body, url, tag });
      const gone: string[] = [];
      await Promise.allSettled(
        subs.map((s) =>
          webpush
            .sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
              { TTL: 60 * 60 * 24 }
            )
            .catch((e: { statusCode?: number }) => {
              // The person turned alerts off or uninstalled the app.
              if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.id);
            })
        )
      );
      if (gone.length > 0) await admin.from("push_subscriptions").delete().in("id", gone);
    }

    if (EMAIL_BACKUP_KINDS.includes(message.kind) && emailConfigured()) {
      const withDevice = new Set(configure() ? subs.map((s) => s.user_id) : []);
      const noDevice = ids.filter((id) => !withDevice.has(id));
      if (noDevice.length > 0) {
        const { data: people } = await admin
          .from("profiles")
          .select("email")
          .in("id", noDevice)
          .eq("email_alerts", true)
          .not("approved_at", "is", null)
          .is("disabled_at", null);
        const emails = ((people as { email: string | null }[] | null) ?? [])
          .map((p) => p.email?.trim())
          .filter((e): e is string => !!e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !isDemoEmail(e));
        const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.boathouseos.app";
        const { html, text } = alertEmail(title, body, `${site}${url}`);
        await sendEmails(emails, title, html, text);
      }
    }
  } catch (e) {
    console.error("sendPush failed", e);
  }
}

// Approved, active members, optionally only these roles.
export async function activeMemberIds(roles?: string[]): Promise<string[]> {
  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select("id")
    .not("approved_at", "is", null)
    .is("disabled_at", null);
  if (roles) query = query.in("role", roles);
  const { data } = await query;
  return ((data as { id: string }[] | null) ?? []).map((p) => p.id);
}

// Parents plus anyone linked to a rower as a guardian (a coach can be both),
// matching who sees the food tent banners.
export async function familyMemberIds(): Promise<string[]> {
  const admin = createAdminClient();
  const [parents, active, { data: links }] = await Promise.all([
    activeMemberIds(["parent"]),
    activeMemberIds(),
    admin.from("family_links").select("guardian_id"),
  ]);
  const activeSet = new Set(active);
  const guardians = ((links as { guardian_id: string }[] | null) ?? [])
    .map((l) => l.guardian_id)
    .filter((id) => activeSet.has(id));
  return [...new Set([...parents, ...guardians])];
}

// Called on sign-out, while still signed in: drops the subscription for the
// device signing out, so a shared phone doesn't keep getting the previous
// person's alerts. Uses the member's own client, so RLS only lets it delete
// their own row whatever the cookie says.
export async function forgetThisDevicesPush() {
  try {
    const jar = await cookies();
    const endpoint = jar.get(PUSH_ENDPOINT_COOKIE)?.value;
    if (!endpoint) return;
    jar.delete(PUSH_ENDPOINT_COOKIE);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  } catch (e) {
    console.error("forgetThisDevicesPush failed", e);
  }
}

// Eastern-time label for alert text, since the server runs in UTC.
export function formatAlertTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Parents/guardians of these rowers, plus the guardians' spouses.
export async function guardianIdsFor(rowerIds: string[]): Promise<string[]> {
  if (rowerIds.length === 0) return [];
  const admin = createAdminClient();
  const { data: links } = await admin.from("family_links").select("guardian_id").in("rower_id", rowerIds);
  const guardians = [...new Set(((links as { guardian_id: string }[] | null) ?? []).map((l) => l.guardian_id))];
  if (guardians.length === 0) return [];

  const [{ data: theirSpouses }, { data: spousesOfThem }] = await Promise.all([
    admin.from("profiles").select("spouse_id").in("id", guardians).not("spouse_id", "is", null),
    admin.from("profiles").select("id").in("spouse_id", guardians),
  ]);
  return [
    ...new Set([
      ...guardians,
      ...((theirSpouses as { spouse_id: string }[] | null) ?? []).map((p) => p.spouse_id),
      ...((spousesOfThem as { id: string }[] | null) ?? []).map((p) => p.id),
    ]),
  ];
}

// Who handles a rower's bills: their guardians (and spouses), or the rower
// themselves if nobody's linked (an adult rower).
export async function householdIdsForRower(rowerId: string): Promise<string[]> {
  const guardians = await guardianIdsFor([rowerId]);
  return guardians.length > 0 ? guardians : [rowerId];
}

// Admins and treasurers (who manage payments).
export async function treasurerIds(): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id")
    .or("role.eq.admin,is_treasurer.eq.true")
    .not("approved_at", "is", null)
    .is("disabled_at", null);
  return ((data as { id: string }[] | null) ?? []).map((p) => p.id);
}
