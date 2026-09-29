import { createHash, timingSafeEqual } from "node:crypto";
import { syncAllConcept2 } from "@/lib/concept2";

// Constant-time compare (hashing first makes the lengths equal).
function matches(given: string, expected: string) {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// Called hourly by pg_cron (0101_concept2_links.sql) with
// "Authorization: Bearer <CRON_SECRET>". Signed out, so middleware skips it.
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !matches(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new Response("Unauthorized.", { status: 401 });
  }
  return Response.json(await syncAllConcept2());
}

export const POST = handle;
export const GET = handle;
