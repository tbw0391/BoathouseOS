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
- [x] Edit an existing event (title, times, location, description, recurrence)
- [ ] RSVP (attending / not attending) per event
- [ ] Calendar view
- [ ] Calendar on the Schedule page showing standing practice times: Mon-Fri 4:15-6:30pm, Saturday 8-10am
- [ ] Weather forecast button on a regatta event, using its location field to
      show the forecast for race day (needs a geocoding/weather API — TBD which)

## Race Results
- [ ] Mark a race final as finished with a placement (1st/2nd/3rd) once results are posted
- [ ] Show a regatta icon with a medal (1st/2nd/3rd) on the schedule once a race final we're in has finished
- [ ] Notify people when a Westerville boat is actually racing down the course
      (live, while the race is happening) — depends on push notifications
      (PWA) being built first; also need to decide the trigger: someone at
      the course manually marks "racing now" vs. pulling from a live regatta
      timing feed, if the regatta provides one

## Lineups
- [x] Create a lineup/boat for an event (boat name, boat class from a
      standard list — 1x/2x/2-/4+/4x/4-/8+ — auto-generates the right seats)
- [x] Assign rowers/coxswain to seats (coach/admin only, everyone else sees
      read-only names)
- [x] View lineups by event, grouped under each schedule event like Food Tent
- [x] Category per boat (2026-09-21 decision: replaced the Varsity/Novice
      split with a numbered depth chart, since depth is per boat class, not
      a fixed team-wide rank — e.g. someone can be in the 1V8 and the 2V4
      at the same regatta): Men's/Women's 1st-4th for each team boat class
      (8+, 4+, 4x, 4-; singles/doubles/pairs intentionally have no depth
      categories), plus Masters and Development. Boats grouped under a
      heading per category within each event; category dropdowns grouped
      by Men's/Women's/Other since it's now 34 options.
- [x] Seat assignment is restricted to the matching roster group (e.g. a
      Men's boat can only pull from the Men's group, Masters only from
      Masters) — an already-assigned person outside the group still shows
      correctly, just can't be newly picked for a mismatched boat
- [x] Reusable boat fleet: named boats (Chase, OSU, Tin Tin, Athena, New M,
      Ulysses, Mantis, Killer Queen, M2, 08 — all seeded as 8+ for now) with
      a fixed class each, editable anytime from the Fleet section on the
      Lineups page. Creating a lineup now picks a boat from this list instead
      of typing a name/class each time.
- [ ] Edit an existing lineup's category/notes (the boat itself is now
      editable via the fleet, but a lineup entry is still create-or-delete
      only for category/notes)
- [x] Race time/name per lineup (distinct from the regatta's overall start
      time), editable inline; shown on the rower/parent home-page banner
- [x] Races collected before assignment: a `races` table (name, category,
      time, tied to an event) that a coach bulk-imports from Excel/CSV,
      independent of any boat/crew. A race with no lineup yet shows under
      "Races needing a lineup" on the Lineups page for that event.
- [x] Home-screen banner for coaches/admins: "N races still need a lineup
      for <regatta>" once races have been imported without an assignment.
- [x] Lineup Templates: a reusable named crew (e.g. "Men's 1V8", "Men's
      2V8") a coach defines once — boat class + seat-by-seat crew, no
      specific physical boat attached — managed from a "Lineup Templates"
      section on the Lineups page. Applying a template to a pending race
      asks which physical boat from the fleet to use (must match the
      template's boat class), creates a real lineup with the crew
      pre-filled, and the race is no longer pending. The template itself is
      untouched by later edits to that lineup, and can be reapplied to
      other races (e.g. week after week) independently.
- [ ] Template roster restriction: unlike a live lineup's seat picker (which
      only offers the matching squad group), a template's seat picker
      currently offers the full roster regardless of category — fine for
      now, but worth tightening later if it causes mistakes.

## Volunteer needs
- [ ] Post volunteer needs (e.g. regatta day tent/food requests), tied to an event
- [ ] Sign up for a volunteer slot
- [ ] Track slots filled vs. needed

## Workouts
- [ ] Content TBD (button/route scaffolded, waiting on requirements)

## Rookie Parent
- [ ] Rookie Parent tile/button (home page) as a resource hub for new parents,
      with more buttons underneath it: FAQ, What to Bring, Food Tent/Parking/
      Tent location

## Food Tent
- [x] Tent leader flag (admin-assignable, separate from role)
- [x] Signup-genius-style item requests tied to a regatta day
- [x] Sign up to bring a quantity of an item, cancel your own signup
- [x] Home page banner listing what you've signed up to bring for
      upcoming events
- [x] Edit/delete an item request (title, quantity, notes)
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

## Apparel
- [ ] Apparel Chair account: a role/flag (like the existing Tent Leader flag)
      that admin assigns to a specific person
- [ ] Apparel button on the home page, visible only to admins and whoever's
      assigned Apparel Chair (content/purpose of the page TBD)

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
- [x] Admin-only visibility (2026-09-21 decision: narrowed from
      coaches+admins to admins only) — admins see all submitted suggestions,
      can mark them reviewed or delete them once acted on (e.g. added to
      this backlog)
- [x] Submitter picks a category: Club (about club operations) or App
      (about the software) — required at submission, shown as a badge on
      each suggestion
- [ ] Route by category once Club admin / Global admin roles exist (depends
      on the Multi-tenant SaaS work below): "app" suggestions go to Global
      admins, "club" suggestions go to that club's own admins. For now both
      categories are just captured and shown to the single admin role, since
      there's only one club and no global-admin concept yet.

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
      which club), Stripe billing, a super-admin view to manage clubs. The
      "super-admin" here is the Global admin referenced under Suggestions
      above (Todd, across all clubs) — distinct from each club's own
      Club admin (today's `role = 'admin'`, scoped to their club_id).
- [ ] Pricing model TBD — leaning toward flat monthly/annual fee tiered by
      roster size (matches how similar tools like TeamSnap/Spond price, and
      is easy for a volunteer club treasurer to approve) over per-athlete or
      freemium pricing.

## Maintenance requests
- [x] Boat Maintenance: anyone can report an issue with a specific fleet boat
      (picks from the boat list); coaches/admins see all requests, can mark
      resolved/reopen or delete
- [x] Site Maintenance: same flow for boathouse/facility issues, no boat
      picker needed
