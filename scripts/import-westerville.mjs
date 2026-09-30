// One-off: copies Westerville Crew from the old W-Crew-app Supabase project
// into the Westerville club on BoathouseOS production, in the new structure.
//
//   node scripts/import-westerville.mjs            # counts only, writes nothing
//   node scripts/import-westerville.mjs --write    # copy
//
// Old project keys come from ../W-Crew-app/.env.local; production's from
// .env.production-import (PROD_SUPABASE_URL, PROD_SERVICE_ROLE_KEY), which is
// git-ignored. Safe to run again: rows are upserted by their ids, so a second
// run (e.g. at switch-over) brings over anything added or changed since.
//
// Passwords: logins are recreated with the same ids and password hashes, read
// through a temporary function on the old project (export_auth_users_for_move,
// created and dropped by Claude around the run; service role only).

import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const WRITE = process.argv.includes("--write");
const CLUB_SLUG = "westerville";
const TODD_EMAIL = "tbw0391@gmail.com";

function readEnv(file) {
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      })
  );
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const oldEnv = readEnv(path.join(root, "..", "W-Crew-app", ".env.local"));
const newEnv = readEnv(path.join(root, ".env.production-import"));
const OLD_URL = oldEnv.NEXT_PUBLIC_SUPABASE_URL;
const NEW_URL = newEnv.PROD_SUPABASE_URL;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const oldDb = createClient(OLD_URL, oldEnv.SUPABASE_SERVICE_ROLE_KEY, opts);
const newDb = createClient(NEW_URL, newEnv.PROD_SERVICE_ROLE_KEY, opts);

const report = [];
const note = (line) => {
  report.push(line);
  console.log(line);
};

async function all(table) {
  const { data, error } = await oldDb.from(table).select("*").range(0, 9999);
  if (error) throw new Error(`read ${table}: ${error.message}`);
  return data ?? [];
}

async function put(table, rows, onConflict) {
  note(`${table}: ${rows.length}`);
  if (!WRITE || rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await newDb
      .from(table)
      .upsert(rows.slice(i, i + 500), onConflict ? { onConflict } : undefined);
    if (error) throw new Error(`write ${table}: ${error.message}`);
  }
}

const withClub = (rows, clubId, drop = []) =>
  rows.map((r) => {
    const out = { ...r, club_id: clubId };
    for (const c of drop) delete out[c];
    return out;
  });

const MAX_BYTES = { avatars: 5 * 1024 * 1024, photos: 15 * 1024 * 1024 };

// Photo and avatar links point at the old project's storage.
const moveUrl = (u) => (u && OLD_URL && NEW_URL ? u.split(OLD_URL).join(NEW_URL) : u);

async function main() {
  const { data: club, error: clubError } = await newDb.from("clubs").select("id").eq("slug", CLUB_SLUG).single();
  if (clubError || !club) throw new Error(`No "${CLUB_SLUG}" club on production.`);
  const C = club.id;
  note(`${WRITE ? "COPYING" : "DRY RUN (add --write to copy)"} into club ${CLUB_SLUG} (${C})`);

  // --- Logins, same ids and passwords ---
  const { data: users, error: usersError } = await oldDb.rpc("export_auth_users_for_move");
  if (usersError) throw new Error(`export logins: ${usersError.message}`);
  note(`auth users: ${users.length}`);
  if (WRITE) {
    for (const u of users) {
      const { error } = await newDb.auth.admin.createUser({
        id: u.id,
        email: u.email,
        password_hash: u.encrypted_password || undefined,
        email_confirm: true,
        user_metadata: u.raw_user_meta_data ?? {},
      });
      if (error && !/already|exists|registered/i.test(error.message)) {
        throw new Error(`login ${u.email}: ${error.message}`);
      }
    }
  }

  // --- Members ---
  const profiles = await all("profiles");
  const spouses = profiles.filter((p) => p.spouse_id).map((p) => ({ id: p.id, spouse_id: p.spouse_id }));
  await put(
    "profiles",
    profiles.map((p) => ({
      ...p,
      club_id: C,
      spouse_id: null,
      photo_url: moveUrl(p.photo_url),
      // Everyone in the old app was already a member.
      approved_at: p.created_at ?? new Date().toISOString(),
    }))
  );
  if (WRITE) {
    for (const s of spouses) {
      const { error } = await newDb.from("profiles").update({ spouse_id: s.spouse_id }).eq("id", s.id);
      if (error) throw new Error(`spouse ${s.id}: ${error.message}`);
    }
  }
  note(`spouse links: ${spouses.length}`);

  const todd = profiles.find((p) => (p.email ?? "").toLowerCase() === TODD_EMAIL);
  if (todd && WRITE) {
    const { error } = await newDb.from("global_admins").upsert({ user_id: todd.id });
    if (error) throw new Error(`global admin: ${error.message}`);
  }
  note(`global admin: ${todd ? todd.email : "not found"}`);

  await put("profile_teams", withClub(await all("profile_teams"), C));
  await put("family_links", withClub(await all("family_links"), C));
  await put("boats", withClub(await all("boats"), C));

  // --- Schedule. Regatta icons were links to other sites (blocked by the
  // app's security headers); they become the regatta's artwork, stored here.
  const events = await all("schedule_events");
  const eventRows = [];
  for (const e of events) {
    const row = withClub([e], C, ["crewtimer_mobile_id", "crewtimer_synced_at", "icon_url"])[0];
    if (e.icon_url) {
      if (WRITE) {
        try {
          const res = await fetch(e.icon_url);
          if (!res.ok) throw new Error(String(res.status));
          const type = res.headers.get("content-type") ?? "image/png";
          const ext = type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png";
          const objectPath = `${e.id}/imported.${ext}`;
          const { error } = await newDb.storage
            .from("regatta-artwork")
            .upload(objectPath, Buffer.from(await res.arrayBuffer()), { contentType: type, upsert: true });
          if (error) throw error;
          row.artwork_url = newDb.storage.from("regatta-artwork").getPublicUrl(objectPath).data.publicUrl;
        } catch (err) {
          note(`  icon for "${e.title}" not copied: ${err.message ?? err}`);
        }
      }
    }
    eventRows.push(row);
  }
  await put("schedule_events", eventRows);
  await put("event_forecasts", withClub(await all("event_forecasts"), C));

  // --- Task types: the club already has Launch/Recovery; match by name.
  const { data: existingTypes } = await newDb.from("task_types").select("id, name").eq("club_id", C);
  const typeIdByName = new Map((existingTypes ?? []).map((t) => [t.name, t.id]));
  const oldTypes = await all("task_types");
  const typeMap = new Map();
  const newTypes = [];
  for (const t of oldTypes) {
    if (typeIdByName.has(t.name)) typeMap.set(t.id, typeIdByName.get(t.name));
    else {
      typeMap.set(t.id, t.id);
      newTypes.push({ ...t, club_id: C });
    }
  }
  await put("task_types", newTypes);

  // --- Chats. Team chats already exist (one per team); lineup chats are
  // made again as each lineup is copied; the rest keep their ids.
  const { data: teamChats } = await newDb.from("chat_groups").select("id, team").eq("club_id", C).not("team", "is", null);
  const teamChatId = new Map((teamChats ?? []).map((g) => [g.team, g.id]));
  const oldGroups = await all("chat_groups");
  const oldLineups = await all("lineups");
  const lineupGroupIds = new Set(oldLineups.map((l) => l.chat_group_id).filter(Boolean));
  const groupMap = new Map();
  const plainGroups = [];
  for (const g of oldGroups) {
    if (g.team && teamChatId.has(g.team)) groupMap.set(g.id, teamChatId.get(g.team));
    else if (lineupGroupIds.has(g.id)) continue;
    else {
      groupMap.set(g.id, g.id);
      plainGroups.push({ ...g, club_id: C });
    }
  }
  await put("chat_groups", plainGroups);

  // Inserting a lineup makes its chat (create_lineup_chat), so only new
  // ones are inserted; ones already copied are updated in place.
  const lineupRows = withClub(oldLineups, C, ["result_time", "chat_group_id"]);
  const { data: already } = await newDb.from("lineups").select("id").eq("club_id", C);
  const copied = new Set((already ?? []).map((l) => l.id));
  await put("lineups", lineupRows.filter((l) => !copied.has(l.id)));
  if (WRITE) {
    for (const l of lineupRows.filter((row) => copied.has(row.id))) {
      const { error } = await newDb.from("lineups").update(l).eq("id", l.id);
      if (error) throw new Error(`update lineup ${l.id}: ${error.message}`);
    }
  }
  if (WRITE) {
    const { data: made } = await newDb.from("lineups").select("id, chat_group_id").eq("club_id", C);
    const newGroupByLineup = new Map((made ?? []).map((l) => [l.id, l.chat_group_id]));
    for (const l of oldLineups) {
      if (l.chat_group_id && newGroupByLineup.get(l.id)) groupMap.set(l.chat_group_id, newGroupByLineup.get(l.id));
    }
  }
  await put("lineup_seats", withClub(await all("lineup_seats"), C));
  await put("races", withClub(await all("races"), C));

  const mapGroup = (rows) => rows.filter((r) => groupMap.has(r.group_id)).map((r) => ({ ...r, group_id: groupMap.get(r.group_id), club_id: C }));
  await put("chat_group_members", mapGroup(await all("chat_group_members")), "group_id,user_id");
  await put("messages", mapGroup(await all("messages")));

  await put(
    "coach_tasks",
    (await all("coach_tasks")).map((t) => ({ ...t, club_id: C, task_type_id: typeMap.get(t.task_type_id) ?? t.task_type_id }))
  );
  await put("coach_task_assignments", withClub(await all("coach_task_assignments"), C));
  await put("coach_announcements", withClub(await all("coach_announcements"), C));

  await put("lineup_templates", withClub(await all("lineup_templates"), C));
  await put("lineup_template_seats", withClub(await all("lineup_template_seats"), C));

  await put("food_tent_items", withClub(await all("food_tent_items"), C));
  await put("food_tent_signups", withClub(await all("food_tent_signups"), C));
  await put("food_tent_status", withClub(await all("food_tent_status"), C));
  await put("food_tent_wishlist_items", withClub(await all("food_tent_wishlist_items"), C));
  await put("food_tent_wishlist_signups", withClub(await all("food_tent_wishlist_signups"), C));
  await put("volunteer_needs", withClub(await all("volunteer_needs"), C));
  await put("volunteer_signups", withClub(await all("volunteer_signups"), C));

  await put("on_water_sessions", withClub(await all("on_water_sessions"), C));
  await put("location_pings", withClub(await all("location_pings"), C));
  await put("maintenance_requests", withClub(await all("maintenance_requests"), C));

  await put("photos", (await all("photos")).map((p) => ({ ...p, club_id: C, url: moveUrl(p.url) })));
  await put("photo_tags", withClub(await all("photo_tags"), C));

  await put("polls", withClub(await all("polls"), C));
  await put("poll_options", withClub(await all("poll_options"), C));
  await put("poll_invitees", withClub(await all("poll_invitees"), C));
  await put("poll_votes", withClub(await all("poll_votes"), C));

  await put("schedule_views", withClub(await all("schedule_views"), C));
  await put("suggestions", withClub(await all("suggestions"), C));
  await put("club_settings", withClub(await all("club_settings"), C), "club_id,key");

  // --- Photos and profile pictures ---
  for (const bucket of ["avatars", "photos"]) {
    const files = [];
    const { data: folders } = await oldDb.storage.from(bucket).list("", { limit: 1000 });
    for (const f of folders ?? []) {
      const { data: inner } = await oldDb.storage.from(bucket).list(f.name, { limit: 1000 });
      for (const g of inner ?? []) if (g.id) files.push(`${f.name}/${g.name}`);
    }
    note(`storage ${bucket}: ${files.length}`);
    if (!WRITE) continue;
    for (const p of files) {
      const { data: blob, error } = await oldDb.storage.from(bucket).download(p);
      if (error) throw new Error(`download ${bucket}/${p}: ${error.message}`);
      let body = Buffer.from(await blob.arrayBuffer());
      let contentType = blob.type || undefined;
      // The new app caps uploads (0061: 5MB avatars, 15MB photos); the old
      // one didn't. Oversized pictures are shrunk, same file name.
      if (body.length > MAX_BYTES[bucket]) {
        const sharp = require("sharp");
        const format = /\.png$/i.test(p) ? "png" : "jpeg";
        body = await sharp(body).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })[format]({ quality: 85 }).toBuffer();
        contentType = `image/${format}`;
        note(`  shrank ${bucket}/${p} to ${(body.length / 1e6).toFixed(1)}MB`);
      }
      const { error: upError } = await newDb.storage
        .from(bucket)
        .upload(p, body, { contentType, upsert: true });
      if (upError) throw new Error(`upload ${bucket}/${p}: ${upError.message}`);
    }
  }

  note(WRITE ? "Done." : "Dry run finished; nothing was written.");
}

main().catch((e) => {
  console.error("FAILED:", e.message ?? e);
  process.exit(1);
});
