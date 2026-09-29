"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoEmail } from "@/lib/demoAccount";
import { PUSH_ENDPOINT_COOKIE, isPushServiceEndpoint } from "@/lib/push";
import { UserError, tryAction } from "@/lib/userError";

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function savePushSubscription(sub: PushSubscriptionInput, userAgent: string) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");
    // Everyone trying the demo shares this account, so they'd get each
    // other's alerts.
    if (isDemoEmail(user.email)) throw new UserError("Alerts are off in the demo.");

    const { data: me } = await supabase
      .from("profiles")
      .select("approved_at, disabled_at")
      .eq("id", user.id)
      .single();
    const profile = me as { approved_at: string | null; disabled_at: string | null } | null;
    if (!profile?.approved_at || profile.disabled_at) throw new UserError("Your account isn't active.");

    if (
      typeof sub?.endpoint !== "string" ||
      sub.endpoint.length > 1000 ||
      !isPushServiceEndpoint(sub.endpoint) ||
      typeof sub.keys?.p256dh !== "string" ||
      typeof sub.keys?.auth !== "string" ||
      sub.keys.p256dh.length > 200 ||
      sub.keys.auth.length > 100
    ) {
      throw new UserError("That browser sent an invalid subscription.");
    }

    // Service-role upsert on the endpoint, so a device that someone else used
    // to get alerts on moves over to whoever turned them on now.
    const { error } = await createAdminClient()
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          user_agent: String(userAgent ?? "").slice(0, 300) || null,
        },
        { onConflict: "endpoint" }
      );
    if (error) throw new Error(error.message);

    (await cookies()).set(PUSH_ENDPOINT_COOKIE, sub.endpoint, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  });
}

export async function deletePushSubscription(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  (await cookies()).delete(PUSH_ENDPOINT_COOKIE);
}

// Whether this device's subscription is saved for the signed-in person (it
// may belong to someone who used the phone before).
export async function isPushSubscriptionMine(endpoint: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("endpoint", endpoint);
  return (count ?? 0) > 0;
}

// Whether important alerts are emailed when this member has no phone alerts.
export async function setEmailAlerts(on: boolean) {
  return tryAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("Not signed in.");
    const { error } = await supabase.from("profiles").update({ email_alerts: on }).eq("id", user.id);
    if (error) throw new Error(error.message);
  });
}
