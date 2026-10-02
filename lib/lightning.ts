import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeMemberIds, sendPush } from "@/lib/push";
import { compassPoint, LIGHTNING_WAIT_MINUTES, parseWaterSettings, WATER_SETTINGS_KEY } from "@/lib/waterConditions";
import { flashesNearPoint, glmFileStart, type Flash } from "@/lib/lightningMath";

// Automatic lightning warnings: NOAA's GOES-East satellite (GLM) maps every
// lightning flash over the Americas and publishes a file every 20 seconds,
// free, on AWS (noaa-goes19). Every 5 minutes (scheduled alerts) each club
// that turned it on has the last few minutes checked around its weather
// location. A flash in range starts a lightning hold (or restarts its 30
// minutes); a hold started this way clears itself 30 minutes after the last
// flash. GLM places a flash to within about 8 km and sees most, not all.

type Admin = ReturnType<typeof createAdminClient>;

const BUCKET = "https://noaa-goes19.s3.amazonaws.com";
// Each run looks back a little further than the 5 minutes between runs.
const LOOKBACK_MS = 7 * 60 * 1000;
const WATCH_HOURS = { from: 5, to: 21 }; // club time, 5 AM to 9 PM

async function listGlmKeys(fromMs: number, toMs: number): Promise<string[]> {
  const prefixes = new Set<string>();
  for (let t = fromMs; t <= toMs + 3600000; t += 3600000) {
    const d = new Date(Math.min(t, toMs));
    const doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
    prefixes.add(`GLM-L2-LCFA/${d.getUTCFullYear()}/${String(doy).padStart(3, "0")}/${String(d.getUTCHours()).padStart(2, "0")}/`);
  }
  const keys: string[] = [];
  for (const prefix of prefixes) {
    const res = await fetch(`${BUCKET}/?list-type=2&prefix=${encodeURIComponent(prefix)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GLM list ${res.status}`);
    for (const m of (await res.text()).matchAll(/<Key>([^<]+)<\/Key>/g)) {
      const start = glmFileStart(m[1]);
      if (start != null && start >= fromMs && start <= toMs) keys.push(m[1]);
    }
  }
  return keys;
}

let fileNo = 0;

// The good-quality flashes in one GLM file, kept only if inside the box.
async function readFlashes(
  key: string,
  box: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): Promise<Flash[]> {
  const at = glmFileStart(key);
  if (at == null) return [];
  const res = await fetch(`${BUCKET}/${key}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GLM file ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  const h5wasm = (await import("h5wasm/node")).default;
  const { FS } = await h5wasm.ready;
  const path = `/tmp/glm-${process.pid}-${fileNo++}.nc`;
  FS.writeFile(path, bytes);
  const file = new h5wasm.File(path, "r");
  try {
    const lats = file.get("flash_lat") as { value: Float32Array } | null;
    const lons = file.get("flash_lon") as { value: Float32Array } | null;
    const quality = file.get("flash_quality_flag") as { value: Int16Array } | null;
    if (!lats || !lons) return [];
    const flashes: Flash[] = [];
    for (let i = 0; i < lats.value.length; i++) {
      if (quality && quality.value[i] !== 0) continue;
      const lat = lats.value[i];
      const lon = lons.value[i];
      if (lat < box.minLat || lat > box.maxLat || lon < box.minLon || lon > box.maxLon) continue;
      flashes.push({ lat, lon, at });
    }
    return flashes;
  } finally {
    file.close();
    FS.unlink(path);
  }
}

// Every good flash inside the box between two times.
export async function recentFlashes(
  fromMs: number,
  toMs: number,
  box: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): Promise<Flash[]> {
  const keys = await listGlmKeys(fromMs, toMs);
  const flashes: Flash[] = [];
  for (let i = 0; i < keys.length; i += 6) {
    const batch = await Promise.all(keys.slice(i, i + 6).map((k) => readFlashes(k, box)));
    flashes.push(...batch.flat());
  }
  return flashes;
}

type Watch = { clubId: string; name: string; lat: number; lon: number; miles: number };

async function watchedClubs(admin: Admin): Promise<Watch[]> {
  const { data } = await admin.from("club_settings").select("club_id, value").eq("key", WATER_SETTINGS_KEY);
  return ((data as { club_id: string; value: string | null }[] | null) ?? []).flatMap((row) => {
    const s = parseWaterSettings(row.value);
    return s.lightningAuto && s.weatherLat != null && s.weatherLon != null
      ? [{ clubId: row.club_id, name: s.weatherName ?? "the boathouse", lat: s.weatherLat, lon: s.weatherLon, miles: s.lightningMiles }]
      : [];
  });
}

// Holds this started (started_by null) end 30 minutes after the last flash.
async function clearQuietHolds(admin: Admin, clubIds: string[]) {
  const cutoff = new Date(Date.now() - LIGHTNING_WAIT_MINUTES * 60000).toISOString();
  const { data } = await admin
    .from("lightning_holds")
    .select("id, club_id, last_strike_at")
    .in("club_id", clubIds)
    .is("cleared_at", null)
    .is("started_by", null)
    .lt("last_strike_at", cutoff);
  for (const hold of (data as { id: string; club_id: string; last_strike_at: string }[] | null) ?? []) {
    const clearedAt = new Date(new Date(hold.last_strike_at).getTime() + LIGHTNING_WAIT_MINUTES * 60000).toISOString();
    const { data: cleared } = await admin
      .from("lightning_holds")
      .update({ cleared_at: clearedAt })
      .eq("id", hold.id)
      .is("cleared_at", null)
      .select("id");
    if (!cleared?.length) continue;
    await sendPush(await activeMemberIds(hold.club_id), {
      kind: "lightning_hold",
      title: "Lightning hold over",
      body: `No lightning nearby for ${LIGHTNING_WAIT_MINUTES} minutes.`,
      url: "/water",
      tag: "lightning",
    });
  }
}

export async function runLightningWatch(admin: Admin = createAdminClient()) {
  const watches = await watchedClubs(admin);
  if (watches.length === 0) return;
  await clearQuietHolds(admin, watches.map((w) => w.clubId));

  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }));
  if (hour < WATCH_HOURS.from || hour >= WATCH_HOURS.to) return;

  const now = Date.now();
  // Only flashes near some club are kept (a degree is ~70 miles).
  const flashes = await recentFlashes(now - LOOKBACK_MS, now, {
    minLat: Math.min(...watches.map((w) => w.lat)) - 1,
    maxLat: Math.max(...watches.map((w) => w.lat)) + 1,
    minLon: Math.min(...watches.map((w) => w.lon)) - 1.3,
    maxLon: Math.max(...watches.map((w) => w.lon)) + 1.3,
  });

  for (const w of watches) {
    const hit = flashesNearPoint(flashes, w, w.miles);
    if (!hit) continue;
    const hitAt = new Date(hit.at).toISOString();

    const { data: latest } = await admin
      .from("lightning_holds")
      .select("id, last_strike_at, cleared_at")
      .eq("club_id", w.clubId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const hold = latest as { id: string; last_strike_at: string; cleared_at: string | null } | null;

    if (hold && !hold.cleared_at) {
      // Lightning again: the 30 minutes start over.
      if (new Date(hold.last_strike_at).getTime() < hit.at) {
        await admin.from("lightning_holds").update({ last_strike_at: hitAt }).eq("id", hold.id);
      }
      continue;
    }
    // Already handled (a coach cleared the hold after this flash).
    if (hold?.cleared_at && new Date(hold.cleared_at).getTime() >= hit.at) continue;

    const { error } = await admin
      .from("lightning_holds")
      .insert({ club_id: w.clubId, last_strike_at: hitAt, started_by: null });
    if (error) throw new Error(error.message);
    await sendPush(await activeMemberIds(w.clubId), {
      kind: "lightning_hold",
      title: `⚡ Lightning ${Math.max(1, Math.round(hit.miles))} miles ${compassPoint(hit.bearingDeg)} of ${w.name}`,
      body: `Off the water now. All boats head to the nearest safe landing. Wait ${LIGHTNING_WAIT_MINUTES} minutes after the last lightning.`,
      url: "/water",
      tag: "lightning",
    });
  }
}
