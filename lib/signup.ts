// Joining on your own: the "Create an account" link, /signup, and the
// roster's "Invite via QR code". New signups join the club whose address
// they're on (or the invite link's club) and wait for an admin to approve
// them. Set to false to close it; admins can still add members from the
// Roster.
export const SELF_SIGNUP_OPEN = true;

// Clubs (by slug) whose self-signups are approved right away instead of
// waiting for an admin. Westerville, for now (2026-10-01). Admins can still
// remove anyone from the Roster.
export const AUTO_APPROVE_CLUB_SLUGS: readonly string[] = ["westerville"];
