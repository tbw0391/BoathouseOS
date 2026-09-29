// Which server errors get reported to global admins (lib/errorReports.ts),
// and how repeats of the same one are grouped.

// Next.js throws these on purpose (redirect(), notFound(), a page that
// can't be static, etc.). They aren't bugs.
const NEXT_CONTROL_FLOW = /^(NEXT_|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/;

export function shouldReport(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  // Something the person can fix ("Enter a US mobile number"), not a bug.
  if (err.name === "UserError") return false;
  const digest = (err as { digest?: unknown }).digest;
  if (typeof digest === "string" && NEXT_CONTROL_FLOW.test(digest)) return false;
  if (NEXT_CONTROL_FLOW.test(err.message)) return false;
  // A page left open across a deploy calling an action that's since
  // changed; reloading fixes it.
  if (err.message.startsWith("Failed to find Server Action")) return false;
  return true;
}

// The same error on the same page groups together even when an id or count
// in the message differs.
export function groupingKey(message: string, route: string | null): string {
  const general = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d+/g, "<n>");
  return `${route ?? ""}\n${general}`;
}

// The top of a stack trace is enough to find the line; the rest is noise.
export function shortStack(stack: string | undefined, lines = 8): string | null {
  if (!stack) return null;
  return stack.split("\n").slice(0, lines + 1).join("\n");
}
