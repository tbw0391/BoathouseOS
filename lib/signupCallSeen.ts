// Which events' "signups are open" home banners someone has already clicked
// through (to Food Tent or Volunteer Needs). Kept in a cookie so the server-
// rendered home page can leave those banners out.
export const SIGNUP_CALL_SEEN_COOKIE = "signup_call_seen";

export function parseSignupCallSeen(value: string | undefined): string[] {
  return value ? decodeURIComponent(value).split(",").filter(Boolean) : [];
}
