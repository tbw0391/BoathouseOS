import type { Instrumentation } from "next";

export function register() {}

// Every unexpected server error (pages, actions, API routes) goes to the
// global admins; see lib/errorReports.ts. Middleware runs on the edge,
// where the reporter's Node pieces aren't available, so it's skipped.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportServerError } = await import("@/lib/errorReports");
  await reportServerError(err, {
    path: request.path,
    route: context.routePath ?? null,
    routeType: context.routeType ?? null,
  });
};
