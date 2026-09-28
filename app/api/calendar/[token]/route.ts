import { calendarFeedFor } from "@/lib/calendarFeed";

// A member's private calendar feed, polled by their phone's calendar app
// (signed out, so the long random token is the only key). Unknown or
// reset tokens get a 404.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/, "");
  if (!/^[0-9a-f]{48}$/.test(token)) return new Response("Not found", { status: 404 });

  const body = await calendarFeedFor(token, new URL(request.url).origin);
  if (!body) return new Response("Not found", { status: 404 });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="schedule.ics"',
      "Cache-Control": "private, max-age=900",
    },
  });
}
