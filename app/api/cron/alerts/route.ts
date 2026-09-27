import { runScheduledAlerts } from "@/lib/scheduledAlerts";

// Called every 5 minutes by pg_cron (0080_scheduled_alerts.sql) with
// "Authorization: Bearer <CRON_SECRET>". Signed out, so middleware skips it.
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }
  const result = await runScheduledAlerts();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

export const POST = handle;
export const GET = handle;
