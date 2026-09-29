import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { concept2ResultToWorkout, type Concept2Result, type ImportedWorkout } from "@/lib/erg";
import { saveImportedWorkouts } from "@/lib/ergImport";

// Concept2 Logbook API (log.concept2.com/developers/documentation). A
// member connects a rower's logbook once (OAuth, read-only), and
// syncConcept2 pulls new RowErg pieces into erg_workouts: when connecting,
// from "Sync now", and hourly from /api/cron/concept2. Needs
// CONCEPT2_CLIENT_ID and CONCEPT2_CLIENT_SECRET from the API key registered
// at log.concept2.com/developers/keys, with redirect URI
// https://www.boathouseos.app/api/concept2/callback. CONCEPT2_BASE_URL can
// point at https://log-dev.concept2.com for testing. Tokens are in
// concept2_links (0101), which only the service role can read.

export function concept2Configured(): boolean {
  return !!process.env.CONCEPT2_CLIENT_ID && !!process.env.CONCEPT2_CLIENT_SECRET;
}

const base = () => process.env.CONCEPT2_BASE_URL ?? "https://log.concept2.com";
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.boathouseos.app";
export const concept2RedirectUri = () => `${site()}/api/concept2/callback`;

// The first sync goes back this far; later ones only ask for what changed.
const FIRST_SYNC_DAYS = 365;
const MAX_PAGES = 20;
// Read-only. Concept2 wants the same scope on every token request.
const SCOPE = "user:read,results:read";

export function concept2AuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.CONCEPT2_CLIENT_ID!,
    scope: SCOPE,
    response_type: "code",
    redirect_uri: concept2RedirectUri(),
    state,
  });
  return `${base()}/oauth/authorize?${params}`;
}

type Tokens = { access_token: string; refresh_token: string; expires_in: number };

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${base()}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: process.env.CONCEPT2_CLIENT_ID!,
      client_secret: process.env.CONCEPT2_CLIENT_SECRET!,
      ...body,
    }),
  });
  if (!res.ok) throw new Concept2AuthError(`Concept2 refused the sign-in (${res.status}).`);
  const data = (await res.json()) as Partial<Tokens>;
  if (!data.access_token || !data.refresh_token) throw new Concept2AuthError("Concept2 didn't send a sign-in token.");
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: Number(data.expires_in) || 3600 };
}

// Concept2 no longer accepts this connection; the member has to reconnect.
class Concept2AuthError extends Error {}

async function api<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.c2logbook.v1+json" },
  });
  if (res.status === 401) throw new Concept2AuthError("Concept2 no longer accepts this connection.");
  if (!res.ok) throw new Error(`Concept2 ${path} returned ${res.status}.`);
  return (await res.json()) as T;
}

// The callback: trade the code for tokens, find whose logbook it is, save
// the link, and run the first sync.
export async function connectConcept2(profileId: string, code: string, connectedBy: string) {
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: concept2RedirectUri(), scope: SCOPE });
  const me = await api<{ data: { id: number } }>("/api/users/me", tokens.access_token);
  const admin = createAdminClient();
  const { error } = await admin.from("concept2_links").upsert({
    profile_id: profileId,
    c2_user_id: me.data.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    connected_by: connectedBy,
    connected_at: new Date().toISOString(),
    last_synced_at: null,
    last_error: null,
  });
  if (error) throw new Error(error.message);
  return syncConcept2(profileId);
}

type Link = {
  profile_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  last_synced_at: string | null;
};

// "YYYY-MM-DD HH:MM:SS" in GMT, as the results endpoint's updated_after wants.
function gmtStamp(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// Pulls this rower's new or changed RowErg pieces since the last sync (a
// day of overlap, since matching on source_ref skips repeats). Returns how
// many were added, or null if they aren't connected.
export async function syncConcept2(profileId: string): Promise<{ added: number } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("concept2_links")
    .select("profile_id, access_token, refresh_token, expires_at, last_synced_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  const link = data as Link | null;
  if (!link) return null;

  try {
    let token = link.access_token;
    if (Date.parse(link.expires_at) - Date.now() < 60_000) {
      const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: link.refresh_token, scope: SCOPE });
      token = fresh.access_token;
      await admin
        .from("concept2_links")
        .update({
          access_token: fresh.access_token,
          refresh_token: fresh.refresh_token,
          expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
        })
        .eq("profile_id", profileId);
    }

    const startedAt = new Date();
    const filter: Record<string, string> = link.last_synced_at
      ? { updated_after: gmtStamp(new Date(Date.parse(link.last_synced_at) - 24 * 60 * 60 * 1000)) }
      : { from: new Date(Date.now() - FIRST_SYNC_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) };
    const rows: ImportedWorkout[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({ type: "rower", number: "250", page: String(page), ...filter });
      const res = await api<{ data: Concept2Result[]; meta?: { pagination?: { total_pages?: number } } }>(
        `/api/users/me/results?${params}`,
        token
      );
      for (const r of res.data ?? []) {
        const w = concept2ResultToWorkout(r);
        if (w) rows.push(w);
      }
      if (page >= (res.meta?.pagination?.total_pages ?? 1)) break;
    }

    const { added } = await saveImportedWorkouts(admin, profileId, rows, null);
    await admin
      .from("concept2_links")
      .update({ last_synced_at: startedAt.toISOString(), last_error: null })
      .eq("profile_id", profileId);
    return { added };
  } catch (e) {
    if (e instanceof Concept2AuthError) {
      await admin
        .from("concept2_links")
        .update({ last_error: "Concept2 disconnected. Connect again to keep syncing." })
        .eq("profile_id", profileId);
      return { added: 0 };
    }
    throw e;
  }
}

// Everyone connected, one at a time (for the hourly job).
export async function syncAllConcept2(): Promise<{ synced: number; failed: number; added: number }> {
  const admin = createAdminClient();
  const { data } = await admin.from("concept2_links").select("profile_id").is("last_error", null);
  let synced = 0;
  let failed = 0;
  let added = 0;
  for (const { profile_id } of (data as { profile_id: string }[] | null) ?? []) {
    try {
      const r = await syncConcept2(profile_id);
      added += r?.added ?? 0;
      synced++;
    } catch (e) {
      failed++;
      console.error("Concept2 sync failed", profile_id, e);
    }
  }
  return { synced, failed, added };
}
