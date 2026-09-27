import { createHash, timingSafeEqual } from "node:crypto";
import { runScheduledAlerts } from "@/lib/scheduledAlerts";

// Constant-time compare (hashing first makes the lengths equal).
function matches(given: string, expected: string) {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// Called every 5 minutes by pg_cron (0080_scheduled_alerts.sql) with
// "Authorization: Bearer <CRON_SECRET>". Signed out, so middleware skips it.
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !matches(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new Response("Unauthorized.", { status: 401 });
  }
  const result = await runScheduledAlerts();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

export const POST = handle;
export const GET = handle;
