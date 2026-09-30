// Runs supabase/migrations/*.sql in order against a database, each file in
// its own transaction, stopping at the first failure. Records what ran in
// ops.applied_migrations so a second run only does the new files.
//
//   node scripts/apply-migrations.mjs            # production (PROD_DB_URL in .env.production-import)
//   node scripts/apply-migrations.mjs --list     # what would run
//
// Used to build production from scratch and, after testing on the demo, to
// bring production up to date ("promote to production").

import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env.production-import"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const dir = path.join(root, "supabase", "migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new Client({ connectionString: env.PROD_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
// Kept outside public, so the app's per-table rules (club isolation, the
// approval gate) never touch it, and the API can't see it.
await client.query(`create schema if not exists ops`);
await client.query(`revoke all on schema ops from public, anon, authenticated`);
await client.query(`create table if not exists ops.applied_migrations (
  name text primary key, applied_at timestamptz not null default now())`);
const { rows } = await client.query("select name from ops.applied_migrations");
const done = new Set(rows.map((r) => r.name));
const todo = files.filter((f) => !done.has(f));
console.log(`${done.size} already applied, ${todo.length} to run`);
if (process.argv.includes("--list")) {
  console.log(todo.join("\n"));
  await client.end();
  process.exit(0);
}

for (const f of todo) {
  const sql = fs.readFileSync(path.join(dir, f), "utf8");
  // A few files manage their own transaction (begin; ... commit;).
  const ownTx = /^\s*begin\s*;/im.test(sql) && /^\s*commit\s*;/im.test(sql);
  try {
    if (!ownTx) await client.query("begin");
    await client.query(sql);
    if (!ownTx) await client.query("commit");
    await client.query("insert into ops.applied_migrations (name) values ($1)", [f]);
    console.log(`ok   ${f}`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.error(`FAIL ${f}: ${e.message}`);
    await client.end();
    process.exit(1);
  }
}
await client.end();
console.log("All migrations applied.");
