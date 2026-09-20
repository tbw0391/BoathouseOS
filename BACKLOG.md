# W-Crew-app Backlog

## Roster
- [x] Read-only roster list (name, role, boat side, phone, email)
- [x] Add member form (admin/coach)
- [x] Bio page per member (address, phone, birthday, high school, grad year,
      fun fact, photo, 2K/5K erg time, team, board member flag)
- [x] Edit member profile (self, or coach/admin)
- [x] Disable/remove member (soft delete: "Remove from roster" on a profile
      hides them from the roster and count; admin/coach can restore anytime,
      no data is actually deleted)
- [x] Signup flow so new members can self-register (/signup: name, email,
      password, role (rower/coxswain/parent), and groups)
- [x] QR code button (roster page, admin/coach only) that shows a scannable
      link to the signup page for recruiting new members
- [x] Self-selectable groups at signup and profile edit: Men's, Women's,
      Development, Alumni, Masters, Parent — pick any combination, editable
      later. Board Member intentionally excluded from self-select (2026-09-20
      decision: admin assigns it via the existing profile-page toggle, not
      something people pick for themselves)
- [ ] Role-specific profile view: parents, coaches, board members, and rowers
      each see different buttons/actions on their profile (buttons TBD per role)

## Schedule
- [x] List upcoming/past events, split into Regattas and Practice
- [x] Create/delete event (coach/admin), including recurrence (weekly/monthly/yearly)
- [ ] Edit an existing event (currently delete + recreate)
- [ ] RSVP (attending / not attending) per event
- [ ] Calendar view
- [ ] Calendar on the Schedule page showing standing practice times: Mon-Fri 4:15-6:30pm, Saturday 8-10am

## Race Results
- [ ] Mark a race final as finished with a placement (1st/2nd/3rd) once results are posted
- [ ] Show a regatta icon with a medal (1st/2nd/3rd) on the schedule once a race final we're in has finished
- [ ] Notify people when a Westerville boat is actually racing down the course
      (live, while the race is happening) — depends on push notifications
      (PWA) being built first; also need to decide the trigger: someone at
      the course manually marks "racing now" vs. pulling from a live regatta
      timing feed, if the regatta provides one

## Lineups
- [ ] Create a lineup for an event (boat name, boat class)
- [ ] Assign rowers/coxswain to seats
- [ ] View lineups by event

## Volunteer needs
- [ ] Post volunteer needs (e.g. regatta day tent/food requests), tied to an event
- [ ] Sign up for a volunteer slot
- [ ] Track slots filled vs. needed

## Workouts
- [ ] Content TBD (button/route scaffolded, waiting on requirements)

## Food Tent
- [x] Tent leader flag (admin-assignable, separate from role)
- [x] Signup-genius-style item requests tied to a regatta day
- [x] Sign up to bring a quantity of an item, cancel your own signup
- [x] Home page banner listing what you've signed up to bring for
      upcoming events
- [ ] Edit/delete an item request (currently add-only)
- [ ] Delete a regatta day
- [ ] Master food tent item list: kitchen/tent leader enters the full list of
      typical items once, then for a new regatta just picks/checks which ones
      to request instead of retyping items from scratch every time

## Photos
- [x] Anyone can post a photo (top-left camera icon on every page, plus a
      Photos tile on the home page)
- [x] Tag roster members in a photo
- [x] A tagged member sees the photo on their own bio page
- [ ] Photo comments / likes

## Team store
- [x] Admin-editable link (club_settings.team_store_url)
- [x] Store page that just links out

## Messaging
- [x] Group chat list, with a "New message" flow to start a chat/DM with any
      combination of people on the roster
- [x] Send/receive messages in a group, live via Supabase Realtime
- [x] Unread counts (badge on the home page Messages tile)
- [x] Direct messages (any user can start a 1:1 chat with any other user)
- [x] Auto-add members to the matching team group chat when their team
      changes — one persistent chat group per team (Men's, Women's,
      Development, Masters, Alumni, Parent, Coach), kept in sync via a DB
      trigger on profile_teams so it works regardless of which code path
      changes someone's groups
- [ ] Board Member chat group (not yet wired up — board membership isn't a
      profile_teams row, it's the separate is_board_member flag)

## Banners
- [ ] Birthday banner (show on a member's birthday)
- [ ] New PR banner: when a rower enters a 2K/5K erg time that's faster than
      their previous best for that distance, it counts as a new personal
      record and that person sees a congrats banner on their own home page
      (note: erg times are currently a single overwritable field per profile
      with no history, so this needs an erg-time-log table to detect "faster
      than previous" rather than just "changed")
- [ ] Regatta-week popup banners, starting the week before a regatta:
      food tent request reminder, lineups reminder, coaches' messages reminder

## Infra / cross-cutting
- [x] Real app icons (favicon, PWA icons, home page/login logo) — club branding
- [ ] Nav bar / bottom tab bar instead of home-page button grid once there are more screens
- [ ] Role-based UI (hide admin-only actions from rowers/parents)
- [x] In-app unread indicators: home page badges for unread messages and for
      new schedule events since you last checked (step 1 toward real push
      notifications)
- [ ] Real push notifications (phone alert even when the app is closed) for
      new messages / schedule changes (PWA) — step 2, once ready
- [ ] Deploy (Vercel) + point a real domain
- [x] Admin-only "To-do List" tile (/todo) that reads and renders this
      BACKLOG.md file right in the app, so Todd doesn't have to open the repo

## Suggestions
- [x] Suggestion box: anyone can submit an idea from a "Suggestions" tile on
      the home page
- [x] Coaches/admins see all submitted suggestions, can mark them reviewed
      or delete them once acted on (e.g. added to this backlog)

## Safe Sport compliance
- [ ] Make the app compliant with US Rowing / Safe Sport requirements —
      Todd is gathering the specific requirements and will share them.
      Likely touches messaging (e.g. rules around private adult-minor
      communication), roster/background-check tracking, and photos; don't
      guess at requirements, wait for the actual list.

## Multi-tenant SaaS (sell to other rowing clubs)
- [ ] Do this after everything else is configured/stable. Goal: sell this app
      to 100+ other rowing clubs, each with fully isolated data. Today there
      is zero tenant isolation (almost every RLS policy is "readable by any
      authenticated user") since there's only ever been one club.
- [ ] Phase 1 (schema + RLS isolation only — no branding/onboarding/billing
      yet) is fully designed and reviewed: a `clubs` table, `club_id` on
      every table with composite FKs to enforce parent/child consistency, a
      `current_club_id()` helper mirroring the existing `is_chat_group_member()`
      pattern, and a full RLS rewrite. Full plan with exact file/policy
      references saved at ~/.claude/plans/deep-snuggling-kahn.md — read that
      file before starting, it has the specific gotchas already found
      (chat_groups' OR-clause policy, the sync_team_chat_membership trigger,
      club_settings' primary key, storage bucket read-isolation limits, etc.)
- [ ] Phase 2+ (deferred, not yet designed): dynamic branding/theming per
      club, self-serve club signup/onboarding (the QR-code invite can encode
      which club), Stripe billing, a super-admin view to manage clubs.
- [ ] Pricing model TBD — leaning toward flat monthly/annual fee tiered by
      roster size (matches how similar tools like TeamSnap/Spond price, and
      is easy for a volunteer club treasurer to approve) over per-athlete or
      freemium pricing.
