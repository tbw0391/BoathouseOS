# BoathouseOS Backlog

## Roster
- [x] Read-only roster list (name, role, boat side, phone, email)
- [x] Add member form (admin/coach)
- [x] Fixed (2026-09-23): submitting "Add member" with an email that already
      has a profile crashed the whole Roster page ("An error occurred in
      the Server Components render") instead of showing a normal inline
      error. Root cause: the "create a login for them" path called
      Supabase's `generateLink` (which resolves to the existing auth user
      for an already-registered email rather than erroring) and then tried
      to insert a second `profiles` row with that same id, hitting an
      unhandled `profiles_pkey` duplicate-key error from Postgres. Now
      checked up front — a clear "A member with this email already exists"
      error, plus a defense-in-depth catch on the insert itself in case of
      a race (two near-simultaneous submissions). Found via live Vercel
      logs (`vercel logs --follow`), since production redacts server error
      messages in the browser by design.
- [x] Bio page per member (address, phone, birthday, high school, grad year,
      fun fact, photo, 2K/5K erg time, team, board member flag)
- [x] Edit member profile (self, or coach/admin)
- [x] Disable/remove member (soft delete: "Remove from roster" on a profile
      hides them from the roster and count; admin/coach can restore anytime,
      no data is actually deleted)
- [x] Signup flow so new members can self-register (/signup: name, email,
      password, role (rower/coxswain/parent), and groups)
- [x] Self-service "Forgot password?" (2026-09-23): standard Supabase email
      flow — /forgot-password sends a reset link (always shows the same
      "check your email" message whether or not that email has an account,
      so it can't be used to probe who's registered), the link hits
      /auth/callback (a Route Handler, the only place allowed to persist
      the session cookie from the reset code — a Server Component can't set
      cookies at all) which exchanges the code for a session and lands on
      /reset-password to set a new one. Complements the existing admin-reset
      tool on a member's profile (2026-09-23, same day) rather than
      replacing it. Caveat: this app has no custom email provider
      configured, so delivery relies on Supabase's built-in sender, which is
      rate-limited and not meant for production reliability — worth
      revisiting if reset emails turn out to be slow/unreliable/in spam.
      Needs the deployed origin's `/auth/callback` added to Supabase's Auth
      → URL Configuration → Redirect URLs allow-list, or the reset link
      won't complete.
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
- [x] Admin can reset another member's password (2026-09-23): "Reset
      password" button on a member's profile page (admin-only), sets their
      password directly via the Supabase admin API
      (`auth.admin.updateUserById`, `lib/supabase/admin.ts`) — no email
      involved. A "Generate" button fills in a random one, or the admin can
      type their own; either way it's shown once for the admin to relay to
      the member directly. Chosen over an emailed "forgot password" link
      since this app has no outbound email configured yet and self-service
      change-your-own-password doesn't exist either — this was the more
      reliable near-term fix for a small club. A roster-only member (no
      login) surfaces a clear "nothing to reset" error instead of a raw API
      failure.

## Schedule
- [x] List upcoming/past events, split into Regattas and Practice
- [x] Create/delete event (coach/admin), including recurrence (weekly/monthly/yearly)
- [x] Edit an existing event (title, times, location, description, recurrence)
- [ ] RSVP (attending / not attending) per event (not now — Todd will pick it up later)
- [x] Calendar view (2026-09-27): month grid on /schedule under the Regattas/
      Practice tiles. Dots per day by type; tap a day to list what's on it
      (regattas link to their page). Weekly/monthly/yearly events repeat.
- [x] Standing practice times on the calendar: Mon-Fri 4:15-6:30pm,
      Saturday 8-10am (STANDING_PRACTICES in lib/scheduleCalendar.ts),
      hidden on days that already have a practice or regatta scheduled.
- [x] Weather forecast banner for a regatta (2026-09-22): shows on the home
      page once the nearest regatta is within 7 days (National Weather
      Service's forecast horizon) — high/low, short forecast, precip
      chance, wind, icon. Switched from Weather Underground to the National
      Weather Service (api.weather.gov): WU's public API was discontinued
      years ago and the only current path is IBM's paid/approved PWS
      Dashboard API, which we don't have a key for; NWS is free, no key,
      and authoritative for US locations. Geocodes the event's location
      field via Nominatim (OpenStreetMap, also free/no-key) once, then
      caches lat/lon + the forecast in `event_forecasts`
      (0049_event_forecasts.sql), refreshed opportunistically on page load
      once the cache is >3h stale or the location text changed — not on
      every request.

## Race Results
- [x] Mark a race final as finished with a placement (2026-09-23): a
      "Enter result" control on each boat's LineupCard (Lineups page, next
      to the existing race name/time editor), coach/admin only — a plain
      finishing-place number, not restricted to just 1st/2nd/3rd, since a
      boat can finish 5th too and that's still worth recording. Lives on
      `lineups.place` (0057_lineup_race_results.sql) rather than on the
      underlying `races` row, matching how race_name/race_time already work
      as a per-lineup editable snapshot rather than a live join — also
      covers lineups that were never built from an imported race row.
      Non-managers see a read-only "🥇 1st place" once set, nothing before
      that.
- [x] Show a regatta icon with a medal (1st/2nd/3rd) on the schedule once a
      race final we're in has finished (2026-09-23): on
      Schedule → Regattas, the event's icon row shows 🥇/🥈/🥉 once any of
      its boats has a recorded place of 1-3 (the best place if more than
      one boat placed); no medal for 4th and below, or before results are
      entered. Regatta list only, not Practice.
- [ ] Notify people when one of the club's boats is actually racing down the course
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
      (2026-09-23: superseded by the race-box grid below — events are now a
      button linking to their own page instead of always-expanded inline)
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
- [x] Each boat's own seat pickers exclude whoever's already seated
      elsewhere in that same boat (2026-09-23): pick someone for seat 3 and
      they drop out of every other seat's dropdown for that boat, so the
      same rower can't accidentally end up in two seats of one boat. Each
      boat's list starts full and only shrinks based on its own seats — a
      different boat still shows everyone. No restriction across different
      boats (someone can still be picked for two different boats).
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
- [x] Add races straight from a regatta's own schedule description
      (2026-09-23): a regatta's description can already hold the full
      published heat sheet with the club's own races marked by a trailing ★
      (shows highlighted yellow on the Schedule page). A "★ Add N races from
      the schedule" button now appears on that event's Lineups section
      (coach/admin only) whenever it has starred lines not yet turned into
      races — one click creates a `races` row for each (matched/deduped by
      exact line text against existing races, so re-clicking after adding
      more stars only adds the new ones), and they drop straight into the
      existing "Races needing a lineup" flow: pick a boat, seats fill in
      from the boat's saved crew if it has one, adjust seats as needed. Same
      auto Launch/Recovery task creation as a CSV import.
- [x] Race-box grid per regatta (2026-09-23): the Lineups page is now just a
      button per event (`/lineups/[eventId]`) instead of every event's full
      detail always expanded inline. Clicking a regatta shows a grid of
      boxes, roster-page style — one per race (or per boat, for a lineup
      that was never built from a race row), labeled with its name and
      category/boat class. Box color is the at-a-glance status: white/
      outlined = no boat yet, green = boat assigned, gold/silver/bronze =
      finished with that placement (reuses the `lineups.place` results
      feature). Clicking a box opens its detail below the grid — the boat
      picker if it's still pending, or the full seat/results editor
      (unchanged from before) once a boat's assigned. Fleet and Lineup
      Templates stay page-level on the Lineups index, not per-regatta.
      Extracted the old always-visible lineup card into `LineupDetail.tsx`
      and the boat-assignment form into `AssignBoatPanel.tsx` (replacing
      `PendingRaceRow.tsx`, removed) so both the grid and its detail panel
      share the same components.
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
- [x] Coaches can assign practice/regatta-day tasks to rowers (e.g. launch
      and recovery of boats), not just seat assignments — lives at
      /coach/tasks under a new "Coach" hub tile (2026-09-23), alongside Live
      Tracking (moved from its own top-level tile to /coach/tracking under
      the same hub). Tasks are per schedule event (practice or regatta,
      unlike Volunteer Needs which is regatta-only), coach/admin can
      add/edit/delete a task and toggle which roster members are assigned;
      everyone can see who's assigned, read-only. An "All Rowers" checkbox
      sits at the top of the assign-rowers list to bulk-assign/unassign
      everyone with the rower role in one click, since launch/recovery
      tasks usually go to the whole team rather than picking names one by
      one. New tables `task_types`, `coach_tasks`, `coach_task_assignments`
      (0054_coach_tasks.sql).
- [x] Coaches can add their own custom task types as needed, not just a
      fixed built-in list: `task_types` is a small reusable list (seeded
      with Launch/Recovery) managed from a "Manage task types" toggle at the
      top of the Coach Tasks page, same pattern as the Boat Fleet on
      Lineups. A type in use by a task can't be deleted (FK restrict).
- [x] Auto-create Launch and Recovery tasks for every boat assigned to a
      race (2026-09-23): whenever a lineup is created (both the direct
      "create a lineup" flow and applying a template/fleet boat to a pending
      race), a Launch task and a Recovery task are created automatically for
      that boat, tied to it via `coach_tasks.lineup_id`
      (0055_auto_launch_recovery_tasks.sql, which also backfilled the pair
      for every lineup that already existed). Shows as "Launch — <boat
      name>" on the Coach Tasks page. Best-effort: if the Launch/Recovery
      task types have been renamed or deleted, lineup creation still
      succeeds, it just skips auto-creating tasks. Deleting the lineup
      cascades and removes its auto-created tasks too. Rower assignment is
      still manual (not pre-filled from the boat's own crew, since the
      launch/recovery crew is usually not the same crew racing that boat —
      2026-09-23 decision).
- [x] Home-page banner for a rower's own assigned tasks (2026-09-23, revised
      twice same day): "You're on Launch for <boat name> at <event> (<race
      name>)" — leads with the boat name (the one thing a rower actually
      needs), and swaps the event date out for the race name/number when
      the task's boat has one set, since the date isn't useful here.
      Rower/coxswain only, not shown to parents at all (unlike the lineup
      banner) — this is just "which boat am I on the hook for," not
      something a parent needs to track on the rower's behalf. In-app only,
      same as every other home banner in this app — no push/text/email,
      that's still blocked on the "Real push notifications
      (PWA)" infra item.
- [x] Auto-create Launch and Recovery tasks as soon as a race is added to
      the schedule (2026-09-23), not just once a boat is assigned — a race
      is usually added before its lineup is decided (see "Races collected
      before assignment" under Lineups), so a coach can start lining up
      launch/recovery volunteers right away instead of waiting on the boat.
      New `coach_tasks.race_id` column (0056_auto_tasks_on_race_import.sql,
      also backfilled for every already-pending race), same partial-unique
      /  best-effort pattern as the lineup version. When a boat is later
      assigned to that race, the same Launch/Recovery tasks get re-pointed
      at the new lineup instead of creating a duplicate pair — "Launch —
      Women's 2V8" becomes "Launch — Chase" once the boat's picked, same
      task, same assignees. Falls back to creating a fresh lineup-tied pair
      only if the race never got tasks in the first place.

## Volunteer needs
- [x] Post volunteer needs (title, slots needed, notes), tied to a regatta —
      managed by admin/coach, and tent leader too (2026-09-22: extended to
      match food tent, since tent leader already covers regatta-day
      hospitality/volunteer coordination)
- [x] Sign up for a volunteer slot, cancel your own signup
- [x] Track slots filled vs. needed (shows "Filled" once claimed out; the
      sign-up button disables itself)
- [x] Excel/CSV import for volunteer slots (2026-09-22), same pattern as the
      food tent item import: Title/Task/Name, Slots Needed/Slots/People
      Needed, Description/Notes columns (case-insensitive), only Title
      required
- [x] Edit/delete polish pass (2026-09-24): manager delete button now says
      "Delete slot" (not just "Delete") with a tooltip clarifying it removes
      the slot for everyone, and the confirm dialog points people at the
      "Cancel" link next to their own name if they just want to drop their
      own signup — matching the food tent item's confirm copy.

## Workouts
- [ ] Content TBD (button/route scaffolded, waiting on requirements)

## Rookie Parent
- [x] Rookie Parent tile/button (2026-09-27): /rookie-parent with buttons
      for FAQ, What to Bring, and Food Tent/Parking/Team Tent. Admins write
      each section on the page (stored in club_settings). Content still
      needs writing. Note club_settings is readable signed-out, so keep it
      to non-sensitive info.

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
- [x] Clear a regatta's food list (2026-09-27): "Clear food list" for
      admins/coaches/tent leaders removes that regatta's items, signups,
      and publish status. The regatta itself stays on the schedule (deleting
      it there also deletes its lineups and races).
- [x] Push alert to parents/guardians when the tent leader publishes the
      food list (2026-09-27). The tent leader's "draft ready" alert still
      needs a scheduled job — see "Scheduled alerts" under Infra.

## Photos
- [x] Anyone can post a photo (top-left camera icon on every page, plus a
      Photos tile on the home page)
- [x] Tag roster members in a photo
- [x] A tagged member sees the photo on their own bio page
- [x] Photo comments / likes (2026-09-27, 0078_photo_likes_and_comments.sql):
      heart with count (hover shows who), comments under each photo (author
      or coach/admin can delete), push alert to the uploader on a comment.

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
- [x] Board Member chat group (2026-09-27, 0074): a "Board" chat kept in
      sync with the is_board_member flag by a trigger on profiles.
- [x] Delete a message (2026-09-27, 0073_delete_own_messages.sql): a
      "Delete" link under your own messages removes it for everyone, live.
- [x] Coach announcements (2026-09-22): a one-way broadcast (not a group
      chat) a coach/admin sends from `/announcements`, targeted to all
      Rowers, all Parents, or Both — cuts across team boundaries, unlike the
      existing per-team chat groups. Shows as a home-page banner (Megaphone
      icon) to the matching audience for 7 days; coaches/admins see full
      history + delete on the `/announcements` page instead of a banner on
      their own home page. New `coach_announcements` table
      (0051_coach_announcements.sql), audience-scoped via RLS.

## Banners
- [x] Birthday banner (2026-09-27): the birthday person gets a "Happy
      birthday" banner; everyone else sees "It's X's birthday today!"
      linking to their bio. Eastern date; Feb 29 shows on Feb 28 otherwise.
- [x] New PR banner (2026-09-27, 0074_erg_prs_and_board_chat.sql): an
      `erg_times` log filled by a trigger on profiles (any save path) marks a
      2K/5K faster than the previous best as a PR; the rower sees a gold
      banner for 7 days. Existing times were seeded as the baseline. Only
      m:ss(.s) times are tracked.
- [x] Regatta-week pop-up (2026-09-27): during the 7 days before the next
      regatta, the home page pops up once a day (per device) with "X is in
      N days" and tap buttons: Food Tent (tent leaders: draft to publish;
      families: sign up / see what you're bringing), Races & crews (coaches
      see how many races still need a lineup), and Coach announcements.
- [ ] Race-time notification for the existing rower/parent lineup banner
      (app/page.tsx lineupBanners): actually alert the family 20 min before
      the race's scheduled start, not just show a static banner whenever
      there's an upcoming assignment — depends on real push notifications
      (PWA) being built first, plus a scheduled job to fire at T-20min per
      race. Also: the banner should stop showing once the race has passed,
      not just once it's not "upcoming" by date.

## Infra / cross-cutting
- [x] Real app icons (favicon, PWA icons, home page/login logo) — club branding
- [x] Site colors (2026-09-22): admin picks Primary/Secondary/Accent/
      Background from /admin, stored in club_settings.theme_colors and
      applied site-wide via CSS variables (--color-primary/-secondary/-accent
      plus --background) set inline on `<html>` in the root layout, replacing
      the previously hardcoded #022e5d/#404040/#01213f throughout the app.
      "Reset to defaults" restores the original site colors. Needed
      migration 0052_theme_colors.sql (also opens club_settings reads to
      anon so colors apply on /login and /signup before a session exists).
- [x] Persistent bottom bar (2026-09-22): Home, Lineups, Announcements —
      fixed nav visible on every signed-in screen, sitting alongside the
      existing home-page button grid (not a replacement). Also enables
      `viewport-fit: cover` so its safe-area padding actually applies on
      notched phones.
- [x] Role-based UI (hide admin-only actions from rowers/parents): checked
      2026-09-27, every page already gates its admin controls by role.
- [x] In-app unread indicators: home page badges for unread messages and for
      new schedule events since you last checked (step 1 toward real push
      notifications)
- [x] Real push notifications (2026-09-27, 0076_push_subscriptions.sql):
      home-page "Turn on alerts" prompt (then a small on/off line), per
      device. Alerts for chat messages (other members of the chat), new
      schedule events and time/place changes (everyone), coach
      announcements (same audience as the banner), and food list published
      (parents/guardians). Sent after the response via next/server after()
      from lib/push.ts; dead subscriptions are dropped automatically.
      Signing out removes that device's subscription (push_endpoint
      cookie). Off in the shared demo account. iPhone needs the app added
      to the Home Screen first (the prompt says so).
- [x] Admin on/off switches for each alert, club-wide (2026-09-27): Admin
      Settings → Alerts (chat messages, new events, schedule changes,
      announcements, food list published, photo comments, regatta-week
      pop-up). Stored in club_settings "alert_settings"; missing = on.
      Checked in lib/push.ts sendPush before anything is sent.
- [x] "Boat on the water" alert (2026-09-27): when a coxswain starts
      tracking, the parents/guardians (and their spouses) of the crew get
      an alert — crew = everyone seated in today's lineup for that boat, if
      there is one, plus the coxswain. Skipped if the same boat started in
      the last 30 min. Admin switch: "Boat on the water". Practices without
      a lineup only reach the coxswain's family; a per-boat "follow"
      option for parents could come later.
- [ ] Push setup: generate VAPID keys (`npx web-push generate-vapid-keys`),
      add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to Vercel
      (Production) and .env.local, redeploy. Until then the prompt stays
      hidden and nothing is sent.
- [ ] Scheduled alerts (need a Vercel Cron hitting an API route): the
      tent leader's "draft food list ready" alert from the 7-days-out
      pg_cron job, and race-time alerts 20 min before a race.
- [x] Deploy (Vercel) (2026-09-23): live at https://w-crew-app.vercel.app. The
      Vercel project + its Supabase integration (env vars: POSTGRES_*,
      SUPABASE_*, NEXT_PUBLIC_SUPABASE_*) already existed from ~2026-09-18,
      pointed at the same Supabase project as local dev — just needed
      `vercel link` + `vercel deploy --prod`. No Supabase Auth redirect-URL
      config needed since this app only does email+password sign-in, no
      magic links/OAuth. Env vars are currently only set for the Production
      environment, not Preview/Development, in case future PR-preview
      deploys need them too.
- [x] Point a real (non-vercel.app) domain at the deployment above
      (2026-09-25): https://boathouseos.app (currently redirects to www).
- [x] Check the PWA precache config (2026-09-25): the precache list is just
      _next/static, icons, leaflet markers, and public/branding — fine,
      except the unused source art (Concept.png 2MB, Logo.png, icon.png) was
      downloaded on every install. Now excluded via publicExcludes.
- [x] Fixed (2026-09-25): the login page now deletes every runtime cache
      (keeps only the workbox precache) on load. Was:
      PWA cached signed-in data on the device.
      next-pwa's default runtime caching keeps visited pages ("pages", 24h)
      and cross-origin responses incl. Supabase API reads ("cross-origin",
      1h) in the browser's Cache Storage, and signing out doesn't clear
      them — so roster phones/addresses can linger on a shared device.
      Options: NetworkOnly for those caches (loses offline), or clear
      caches on sign-out.
- [x] next/image for uploaded photos and avatars (2026-09-27): photos page,
      bio page, roster grid, header avatar, via components/StorageImage.tsx
      (non-Supabase URLs fall back to <img>). Cached 31 days since upload
      paths are unique. Watch Vercel's image-optimization usage on the Hobby
      plan if photo volume grows.
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

## Security (before public launch)
- [x] Admin approval for new signups (2026-09-25, migration 0060): self-signups start "pending", see
      only a "waiting for approval" screen, and can't read any club data
      (enforced in the database, not just the UI) until an admin approves
      them. Admins get a pending list with Approve / Decline.
- [x] Lock down privileged profile columns in the database (2026-09-25, 0060): today any
      signed-in user can set their own `role` to 'admin' by calling the
      Supabase API directly (the "users can update their own profile"
      policy doesn't restrict columns; only the server action checks).
      Only admins should be able to change role / approval / board member,
      and only coaches/admins `disabled_at`.
- [x] Per-IP rate limit on the public "Interested?" form (/interest)
      (2026-09-25, 0062_interest_rate_limit.sql): 5 per IP per hour, counted
      from an `ip` column on interest_signups.
- [x] Keep the public demo and real clubs in separate Supabase projects /
      Vercel deployments (the demo reset wipes data, and "Try the demo"
      signs everyone in as an admin). Done 2026-09-25: BoathouseOS runs on
      its own Supabase project and Vercel project (boathouseos), separate
      from W-Crew-app's.
- [x] Supabase password settings (2026-09-25): stronger minimum and
      leaked-password check set in the dashboard.
- [ ] Supabase dashboard settings: custom SMTP for auth emails, MFA on admin and
      Supabase/Vercel/GitHub/registrar accounts, Pro plan for backups.
- [x] Upload size/type limits on the avatars and photos buckets
      (2026-09-25, 0061_storage_upload_limits.sql): both were unlimited;
      now images only (no SVG), 5MB avatars / 15MB photos.
- [x] Dependabot version updates: .github/dependabot.yml (weekly npm,
      minor/patch grouped).
- [x] GitHub settings (2026-09-25): Dependabot alerts + security updates
      on, main protected against force-push and deletion (PRs deliberately
      not required, so web-editor commits still work).
- [x] Privacy policy page (2026-09-25): public /privacy, linked from the
      landing page, signup, and the interest form. Plain-language draft
      written from what the code actually collects — have it looked over
      before real clubs sign up, and update it when data collection changes.
- [ ] Set up email forwarding for privacy@boathouseos.app (the contact on
      /privacy), e.g. Cloudflare Email Routing or the registrar's forwarding.
- [ ] Cisco Secure Access (on the work laptop) blocks boathouseos.app as a
      "security threat", likely because the domain is brand new. Report it
      via the block page's "Report an incorrect block" link; visiting
      coaches on filtered networks may hit the same block.
- [x] Fixed (2026-09-25): the Permissions-Policy header (geolocation=())
      added 2026-09-22 blocked GPS for the whole site, so the On-Water
      tracker couldn't work in production. Now geolocation=(self).
- [x] Advisor leftovers (2026-09-27, 0072_advisor_cleanup.sql): fixed
      search_path on the last three functions; trigger functions and the
      regatta prep job no longer callable over the API; RLS helpers no
      longer callable by signed-out visitors. Remaining advisor warnings
      are intentional (signed-in helpers used by RLS) plus the
      leaked-password setting.
- [ ] Ongoing: new tables need `select public.apply_approval_gate();` at the
      end of their migration. Review RLS on every new table, run /security-review before
      big releases, check Supabase Advisors → Security.

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
- [x] Demo landing page (2026-09-25): /welcome, which signed-out visitors
      to boathouseos.app now land on (deep links still go to /login).
      Tagline, "Try the demo" as the main button, feature cards, the
      interest form, and a sign-in link.
- [ ] Landing page follow-ups: real screenshots of the app (Todd will add
      phone shots of Lineups, a Regatta race, and home in club colors to
      public/branding/screens/), maybe a
      guided tour.
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

## Terms and Conditions
- [x] Terms of Service draft (2026-09-27): public /terms — clubs and
      members, accounts, under-18s, acceptable use, content, payments and
      refunds, On the Water isn't a safety system, the demo, liability,
      leaving, changes. Have a lawyer review before public launch.
- [ ] Decide the refund rule for the 1% convenience fee. The Terms say it
      isn't refunded unless the club or BoathouseOS chooses to, which matches
      Stripe's default (a club refunding from its dashboard keeps the fee
      with BoathouseOS). Also no governing-law/venue clause yet — lawyer.
- [x] Linked from the landing page, signup, the interest form, and /privacy.
      Privacy policy updated the same day: payments/Stripe, erg history,
      check-ins; removed "schedule RSVPs" (not built).
- [x] Signup requires ticking "I agree to the Terms of Service and Privacy
      Policy"; profiles.terms_accepted_at + terms_version record it
      (0075_terms_acceptance.sql, lib/terms.ts TERMS_VERSION). Members an
      admin adds, or who joined earlier, have no record yet — add a
      one-time "please agree" screen if that's needed.

## Payments
- [x] Payments (2026-09-27, 0067_payments.sql): Treasurer flag (admins set
      it on a profile); charges (season/dues/regatta/travel/other) with due
      date; bill a squad, everyone rowing, or picked rowers; families sign
      rowers up for an open season themselves; treasurer discounts (% or $,
      any/one charge, any/one rower, optional end date) applied at sign-up
      or billing, plus per-bill adjustments; cash/check recording, waive,
      cancel, CSV export; "You owe" banner on home.
- [x] Card payments via Stripe Checkout on each club's own connected Stripe
      account: pay in full, or N automatic payments every K days (Stripe
      subscription cancelled after the last one). Card fee covered by club
      or payer (club default, per-charge override). A 1% "Convenience fee"
      is added on top for the payer and goes to BoathouseOS as the
      application fee. Signed webhook at /api/stripe/webhook.
- [x] Apparel (/apparel): in-stock items with per-size counts, and order
      windows with a deadline and a size-by-size list for the vendor; mark
      paid (cash/check), picked up, cancelled. External team store link
      stays on /store.
- [ ] 1. Create a Stripe account at stripe.com, then add STRIPE_SECRET_KEY
      (the sk_test_ key first) and STRIPE_WEBHOOK_SECRET to Vercel and
      .env.local. Nothing charges real money until live keys go in.
- [ ] 2. In Stripe, add a webhook for "events on connected accounts" pointing
      at https://boathouseos.app/api/stripe/webhook, sending
      checkout.session.completed, invoice.paid, charge.refunded and
      account.updated. Its signing secret is STRIPE_WEBHOOK_SECRET. Then
      connect the club on Manage payments and test end to end in test mode.
- [ ] 3. Before going live, check card-network and state rules with Stripe or
      an advisor: a percentage convenience fee (networks generally expect a
      flat one) and payer-covered card fees (surcharging: disclosure, caps,
      not allowed on debit cards, restricted in some states).
- [x] 4. Terms and refund policy drafted 2026-09-27 (see Terms and
      Conditions) — lawyer review and the convenience-fee refund decision
      still open.
- [ ] Payment-plan emails/reminders and a failed-installment alert for the
      treasurer (Stripe retries failed installments on its own).
- [ ] Clubs pay BoathouseOS: Stripe Billing subscription tiered by roster
      size, after multi-club Phase 1.

