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
- [x] Permanently delete a member (admin-only, only offered once already
      soft-removed): actually deletes the profile row, their own messages,
      photos they uploaded, and their login (if any) from the database.
      Things they created that other people's data depends on (schedule
      events, lineups, boats, polls, race templates, food tent/volunteer
      items) are kept for everyone else, just with the author detached —
      only their own singular content is truly deleted. Needs migration
      0040_profile_hard_delete_fks.sql applied before use.
- [x] Roster search/sort/filter: search by name (matches first, last, or
      display name), sort by first or last name, and filter down to one
      group (Men's/Women's/Development/Masters/Alumni/Coaches/Parent) —
      all client-side on the roster table.

## Schedule
- [x] List upcoming/past events, split into Regattas and Practice
- [x] Create/delete event (coach/admin), including recurrence (weekly/monthly/yearly)
- [x] Edit an existing event (title, times, location, description, recurrence)
- [ ] RSVP (attending / not attending) per event
- [ ] Calendar view
- [ ] Calendar on the Schedule page showing standing practice times: Mon-Fri 4:15-6:30pm, Saturday 8-10am
- [ ] Weather forecast banner for a regatta: show the forecast for race day
      (using the event's location field), pulled from Weather Underground,
      starting 5 days before the event date and disappearing after — needs
      to confirm access to a Weather Underground API/feed (their public API
      was discontinued; current access is via IBM/The Weather Company's PWS
      Dashboard API, which needs an account/key) plus a geocoding step to
      turn the location field into coordinates

## Race Results
- [ ] Mark a race final as finished with a placement (1st/2nd/3rd) once results are posted
- [ ] Show a regatta icon with a medal (1st/2nd/3rd) on the schedule once a race final we're in has finished
- [ ] Notify people when a Westerville boat is actually racing down the course
      (live, while the race is happening) — depends on push notifications
      (PWA) being built first; also need to decide the trigger: someone at
      the course manually marks "racing now" vs. pulling from a live regatta
      timing feed, if the regatta provides one
- [ ] Scrape a regatta's published race schedule (heat sheet) directly from
      its results/registration site instead of the coach manually
      building/importing the CSV that `importRaces` uses today, then let a
      coach pick which of our own groups (category) races each entry —
      source site(s) to scrape TBD (e.g. RegattaCentral), and scraping is
      inherently fragile to that site's format changing.

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

## Coach Tasks
- [ ] Coaches can assign practice/regatta-day tasks to rowers (e.g. launch
      and recovery of boats), not just seat assignments — under the coach's
      button/section, separate from Lineups.
- [ ] Coaches can add their own custom task types as needed, not just a
      fixed built-in list (launch/recovery to start, but shouldn't be
      hardcoded to only those).

## Volunteer needs
- [x] Post volunteer needs (title, slots needed, notes), tied to a regatta —
      admin/coach only for now (no separate "volunteer leader" flag like
      tent leader has)
- [x] Sign up for a volunteer slot, cancel your own signup
- [x] Track slots filled vs. needed (shows "Filled" once claimed out; the
      sign-up button disables itself)
- [ ] Edit/delete needs its own polish pass (currently basic — same
      edit/delete pattern as food tent items)

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
      upcoming events, one line per item with a keyword-matched emoji
      (water, cookies, chips, fruit, etc. — falls back to 🍽️)
- [x] 2 gal of water folded into every family's banner automatically
      (isParent OR guardian-of-a-rower via family_links, not just role)
- [x] Edit/delete an item request (title, quantity, notes)
- [x] Wish List moved to the top of the Food Tent page, above the
      per-regatta item lists
- [x] Auto-prep workflow (2026-09-22): a daily pg_cron job
      (0048_regatta_prep_cron.sql) finds regattas exactly 7 days out and,
      if nothing's been added yet, copies the most recent past regatta's
      food list in as an unpublished draft — "same everything," no
      retyping. Tent leader gets a home banner to review/edit (full edit
      rights already covered by the existing isManager check) and hit
      "Confirm & publish," which flips food_tent_items.published and
      alerts parents with a "signups are open" banner
      (food_tent_status table + food_tent_items.published column,
      0047_food_tent_publish_workflow.sql)
- [ ] Delete a regatta day
- [ ] Real device push notifications for the tent-leader/parent alerts
      above — today they're in-app home banners only, which need someone
      to open the app to see. Blocked on the existing "Real push
      notifications... (PWA)" backlog item under Infra, which needs the
      app actually deployed first (see "Deploy (Vercel)" below) plus new
      push-subscription infra (VAPID keys, service worker push handler,
      a subscribe flow, and a way to actually send a push on a schedule —
      e.g. Vercel Cron hitting an API route, since pg_cron can't call
      external push endpoints on its own).

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
- [ ] Race-time notification for the existing rower/parent lineup banner
      (app/page.tsx lineupBanners): actually alert the family 20 min before
      the race's scheduled start, not just show a static banner whenever
      there's an upcoming assignment — depends on real push notifications
      (PWA) being built first, plus a scheduled job to fire at T-20min per
      race. Also: the banner should stop showing once the race has passed,
      not just once it's not "upcoming" by date.
- [ ] Role-changed banner: when an admin changes someone's role (e.g. rower
      -> admin), that person sees a one-time banner on their own home page
      telling them their role changed.

## Infra / cross-cutting
- [x] Real app icons (favicon, PWA icons, home page/login logo) — club branding
- [ ] Persistent bottom bar (all screens): a Home button plus 2-3 more slots,
      content TBD — likely replaces/supplements the home-page button grid
- [ ] Role-based UI (hide admin-only actions from rowers/parents)
- [x] In-app unread indicators: home page badges for unread messages and for
      new schedule events since you last checked (step 1 toward real push
      notifications)
- [ ] Real push notifications (phone alert even when the app is closed) for
      new messages / schedule changes (PWA) — step 2, once ready
- [ ] Deploy (Vercel) + point a real domain
- [ ] Check the PWA precache config (next.config.ts / @ducanh2912/next-pwa)
      once actually deployed — no explicit runtimeCaching set today, so it's
      relying on Workbox's default precache list; worth confirming it isn't
      precaching large/dynamic routes unnecessarily.
- [ ] Swap raw `<img>` tags for `next/image` on photos and avatars (photos
      page, roster bio page, roster table) for automatic resizing/
      optimization — needs the Supabase storage domain added to
      next.config.ts's images.remotePatterns, and a decision on Vercel image
      optimization cost/config once deployed. Low priority at current photo
      volume.
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
- [ ] Demo landing page: a standalone marketing/demo web page (separate from
      the app itself) to show other rowing clubs what the app does when
      pitching — feature overview, screenshots, maybe a guided tour or a
      read-only sandbox login. Purpose/content/hosting still TBD.
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
- [ ] Phase 2+ discussion needed: DNS strategy for auto-provisioning each
      club's own (sub)domain on signup, and per-club customizable branding
      (icon/logo and color scheme) beyond just a club name — both still
      need to be talked through/designed, not just Stripe/onboarding plumbing.
- [ ] Pricing model TBD — leaning toward flat monthly/annual fee tiered by
      roster size (matches how similar tools like TeamSnap/Spond price, and
      is easy for a volunteer club treasurer to approve) over per-athlete or
      freemium pricing.
- [ ] Todd wants to review the Global admin vs. Club admin ("team admin")
      role split in more depth before Phase 1 lands — today there's only a
      single `admin` role with no club scoping at all.

## Maintenance requests
- [x] Boat Maintenance: anyone can report an issue with a specific fleet boat
      (picks from the boat list); coaches/admins see all requests, can mark
      resolved/reopen or delete
- [x] Site Maintenance: same flow for boathouse/facility issues, no boat
      picker needed
