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
- [x] Member profile buttons all the same size (2026-09-28): the admin
      buttons on a member's profile are one width (full width on a phone,
      under the photo; a fixed column on wider screens).
- [x] Role-specific profile view (2026-09-28): shortcut buttons on your own
      profile, chosen per group by an admin in Admin Settings → "Profile
      buttons" (same tap picker as the home-screen buttons). Groups: Rower,
      Coxswain, Parent, Coach, Admin, plus Board Member, whose buttons are
      added on top of their usual group's. Coach-area pages, Manage Payments
      and Admin Settings can only be given to the roles that can open them.
      Sensible defaults until an admin saves. Stored in club_settings
      "profile_buttons". Only shows on your own profile. Members can
      "Arrange" their own buttons with tap arrows (saved per member in
      profiles.profile_button_order, migration 0094); "Reset" goes back to
      the club order, and buttons an admin adds later go at the end.
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
- [x] Delete a regatta from its own page (2026-09-28): "Delete regatta"
      under the title on /lineups/<regatta> (coaches/admins), with a
      two-tap warning spelling out that its races, boats, oar sheets,
      results and medals, food tent, volunteer, trailer and travel lists
      go with it. Before this it was only on Schedule → Regattas.
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
- [x] Notify people when one of the club's boats is actually racing down
      the course (2026-09-28): done by the Racing banner below — the cox's
      GPS crossing the start triggers it.
- [x] Import a regatta's races from CrewTimer (2026-09-27): "From
      CrewTimer" tab under Add races — paste the regatta's CrewTimer link
      and the club's CrewTimer name (remembered per device; tap-to-pick
      list if it doesn't match), tap which entries to add. Uses CrewTimer's
      public JSON feed (lib/crewtimer.ts, shared with the HOTC demo), not
      page scraping; race name, start time and a best-guess category come
      along. Only CrewTimer's feed host is ever fetched.
- [x] Regatta start and finish (2026-09-27, 0082_regatta_course.sql):
      Course tab on each regatta's page. Coaches/admins place each pin by
      tapping the map, "I'm standing here" (phone GPS), or typing
      coordinates (decimal or degrees-minutes-seconds, lib/course.ts).
      Everyone else sees the map. A regatta with no course borrows the
      latest one at the same location. CrewTimer and RegattaCentral don't
      publish course coordinates; Todd (USRowing ref) may get official
      ones for Head of the Ohio.
- [x] Racing banner (2026-09-28, 0098): when a coxswain is tracking on On
      the Water, each GPS ping is checked against the regatta's start and
      finish (its own course, or one borrowed from the same place). Crossing
      the start marks that boat's race (the lineup nearest in time, 45 min
      before to 2 h after its race time) as racing: a green "is racing now
      · Watch live" home banner for everyone, refreshing every 15 s, and a
      "Boat racing now" alert to the crew's parents and the boat's
      followers within seconds. Reaching the finish flips it to "finished"
      (with the place once entered) for an hour. Needs the course set and
      the cox tracking; straight-line course math, so a very bendy course
      may mark the finish a little early or late.
- [ ] RegattaCentral: pick a regatta from RegattaCentral's list when adding
      one to the schedule, with its details and races filled in. Needs
      RegattaCentral's permission/API access rather than scraping.

## Race Day, travel and trailer
- [x] Race Day page (2026-09-28, /race-day, 0083): each race's launch time
      (race time minus the club's 30-90 min setting, admins), bow number
      (coaches enter; CrewTimer "(Bow N)" names fill it in), crew with
      bow/stroke/cox, on-the-water badge, results. Rowers see theirs,
      parents their rowers', coaches all. Home banner on race day; "Launch
      at …" alert to crew and parents shortly before launch.
- [x] Travel tab on each regatta (2026-09-28, 0086): trip times, meeting
      spot, hotel, notes; buses (coaches) and cars (anyone offers theirs)
      with seats members claim for themselves or their rower; rooming list
      coaches build.
- [x] Trailer tab on each regatta (2026-09-28, 0085): coaches build the
      list (every racing boat with oars in one tap, gear presets, copy the
      last regatta's); anyone ticks items packed to go / packed for home.
- [x] Course tab: start and finish pins (see Race Results).

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
- [x] Edit an existing lineup's category/notes (2026-09-27): tap the
      category/notes under a boat in a regatta's lineup to change them.
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
- [x] Template roster restriction (2026-09-27): template and boat-crew seat
      pickers only offer the category's squad, like live lineups; anyone
      already seated stays listed.

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

- [x] Oar sheets (2026-09-28): each regatta boat gets an oar sheet at
      /oar-sheet/<lineup> (also linked from every boat card on Lineups).
      Oars are named by tape color + rings ("3 Green"); the club's colors
      and most rings are set in Admin Settings → Oar tape. The boat's cox —
      or stroke seat in boats with no cox — taps a color and rings for each
      seat (or "whole boat one color", bow = 1 ring), and picks anyone on
      the roster for Launch and Recovery (the boat's auto-created tasks).
      An oar already picked for another boat at the same regatta gets a
      warning. The cox/stroke gets a phone alert when they're put in a
      regatta boat (lineup built for a race, or seat assigned) and a home
      banner until every seat has an oar and Launch/Recovery each have
      someone; the people picked get an alert, and the "You're on Launch"
      banner now shows for any role (was rowers/coxes only). New alert
      switches: "Oar sheet to fill in", "Launch / Recovery pick". Coaches
      and admins can edit any sheet. Needs 0095_oar_sheets.sql (lineup_oars
      table, is_lineup_captain(), and a policy letting the captain assign
      their own boat's tasks).

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
- [x] Fixed (2026-09-28): couldn't type an erg time on a phone — the time
      boxes (Workouts, Seat Racing) open the number pad, which has "." but
      no ":". Dots now stand in for colons: 6.45.2 -> 6:45.2, 18.20.5 ->
      18:20.5 (a one-digit last part is tenths). The box tidies it to
      6:45.2 when you leave it. Profile 2K/5K boxes use the number pad too
      and save tidied, so dotted times count toward PRs.
- [x] Erg workouts (2026-09-28, 0090_erg_workouts.sql): log pieces with
      tap-to-pick distances (2K, 5K, 6K, 1K, 500m, 30/60 min, other); history
      with split and rate; 2K/5K progress chart (faster is higher); Concept2
      logbook CSV import (skips duplicates). A 2K/5K test updates the
      profile time so PR celebrations still fire. Coaches get team rankings
      (best 2K/5K, split, watts, Concept2 weight-adjusted) by squad. Parents
      see and log their rowers'.
- [ ] Concept2 automatic sync: needs a Concept2 Logbook API app
      (log.concept2.com/developers) — client id/secret, then OAuth per rower.
      CSV import covers it until then.

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
- [x] "Signups are open" home banner goes away once clicked (2026-09-28):
      tapping its Food Tent or Volunteer Needs button hides that event's
      banner (remembered in a signup_call_seen cookie, so per device), not
      just after actually signing up. The regatta-week popup still counts
      them as not signed up.
- [x] Trim the home page's "{regatta} is coming up — get ready" buttons
      (2026-09-28): each only shows while there's something to do.
      - "Sign up for the food tent" / "Sign up for a volunteer slot": gone
        once the person has opened that page (by any route).
      - "Check the lineups": only once a boat for that regatta has crew in
        it, and gone once the person opens that regatta's lineups (the
        button now goes straight to /lineups/<regatta>).
      - "Read coaches' messages": only while the coaches' chat has a message
        they haven't read.
      The whole block hides when nothing's left. Visits are remembered per
      person in the database (regatta_prep_seen, 0096), so it clears on
      every device. Until 0096 is applied, food tent/volunteer/lineups
      buttons just keep showing as before.
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
- [x] Tag a whole boat in a photo (2026-09-28): the Add photo form lists
      the boats from the last two weeks by day (Today, Yesterday, Sat Sep
      26...). Tapping a boat tags everyone seated in that day's lineup
      (rowers and cox — it follows the lineup, not the boat's usual crew);
      tapping it again untags them. Tagged people show as chips with an x
      to untag one, and anyone else can still be added from the list.
- [x] A real "Add photo" button (2026-09-28): the Photos page's plain
      "Choose File" box is now a big "Add photo" button in the club colors
      (camera icon) that opens the camera/photo picker, then shows a
      preview of the picked photo with "Change photo".
- [x] A tagged member sees the photo on their own bio page
- [x] Photo comments / likes (2026-09-27, 0078_photo_likes_and_comments.sql):
      heart with count (hover shows who), comments under each photo (author
      or coach/admin can delete), push alert to the uploader on a comment.

## Team store
- [x] Admin-editable link (club_settings.team_store_url)
- [x] Store page that just links out

## Apparel
- [x] Apparel Chair (2026-09-28, 0097): admins tap "Make apparel chair" on
      a member's profile. The chair runs the store at /apparel/manage
      (products, stock, order windows, marking orders picked up or
      cancelled) and gets a "Manage Apparel" home tile (admins too).
      Marking an order paid stays with the treasurer/admins. Pickup and
      cancel go through set_order_handout() so the chair can't change
      prices or mark anything paid.

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
- [ ] Race-time alerts: dropped for now (2026-09-27) because regattas
      usually run late and a fixed "20 minutes before" would fire at the
      wrong time. If revisited: a coach sets a "running late by N min"
      delay on race day, or taps "send 20-minute alert" manually. The lineup
      banner now drops off once a result is recorded or 2 hours after the
      race's scheduled time (2026-09-27).

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
- [x] Home-screen buttons per role (2026-09-27): Admin Settings → Home
      screen buttons — tap Rower / Coxswain / Parent / Coach / Admin, then tap
      which buttons that role sees; "Save all roles". Stored in club_settings
      "nav_access" ({role: [hrefs]}); until first saved it's derived from the
      old per-button nav_visibility. Coach page stays coach/admin only.
      Hides buttons only; the pages themselves keep their own access checks.
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
- [x] Push setup (2026-09-27): VAPID keys generated and added to Vercel
      (Production) and .env.local. NEXT_PUBLIC_VAPID_PUBLIC_KEY is baked in
      at build time, so a redeploy is needed after changing it.
- [x] Scheduled alerts (2026-09-27, 0080_scheduled_alerts.sql): pg_cron +
      pg_net call /api/cron/alerts every 5 min (lib/scheduledAlerts.ts):
      "food list draft ready" to tent leaders/coaches/admins; "payment due"
      3 days before a hand-paid bill's due date and "overdue" the day after
      (families; bills on an automatic plan skipped). Each sent once
      (scheduled_alerts_sent). Failed installments alert the family and
      treasurer from the Stripe webhook (invoice.payment_failed).
- [x] Scheduled alerts setup (2026-09-28): CRON_SECRET in Vercel matches
      the cron_secret vault secret; the 5-minute job gets 200s. The Stripe
      webhook was created with invoice.payment_failed included.
- [x] Parents follow boats (2026-09-27, 0080): "Tell me when these boats go
      out" tap buttons on On the Water; followers get the boat-on-the-water
      alert too.
- [x] Agree-to-Terms pop-up (2026-09-27): approved members whose
      terms_version isn't the current TERMS_VERSION get a blocking pop-up
      (Terms and Privacy pages stay readable) until they agree. Skipped for
      the demo account. Bumping TERMS_VERSION asks everyone again.
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

- [x] Calendar feed (2026-09-28, 0084): Schedule > "Add to my phone's
      calendar" gives each member a private webcal link: events with
      repeats, standing practices (skipping regatta/practice days), and
      their races (parents: their rowers'; coaches: all) with launch time.
      Club time with DST rules. "Make a new link" replaces it.
- [x] Email backup for alerts (2026-09-28, 0092): lightning, practice
      calls, launch reminders, schedule changes, payments and paperwork are
      emailed via Resend to members with no phone-alert device; members can
      untick it on home.
- [x] Email setup (2026-09-28): Resend account, boathouseos.app domain
      verified, RESEND_API_KEY and EMAIL_FROM in Vercel; the home-page email
      checkbox shows. Next: point Supabase Auth's custom SMTP at Resend.

- [ ] Text message (SMS) alerts via Twilio (started 2026-09-28): Todd is
      setting up the Twilio account, number and toll-free (or 10DLC)
      verification. Then: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
      TWILIO_FROM_NUMBER in Vercel; an SMS sender like lib/email.ts for the
      urgent alerts (lightning, practice calls, launch times); an opt-in
      checkbox with consent recorded; STOP opt-outs recorded; texting
      wording in Terms and Privacy; minors' texts go to parents (Safe Sport).

## Safety
- [x] Water Conditions (2026-09-28, /water, 0087): live USGS gauge (flow,
      level, water temp where the gauge has it) and nearest NWS station
      (air temp, wind) against the club's limits, incl. the cold-water rule
      (air + water < 100°F). Admins set the gauge (demo: 03049500,
      Allegheny at Natrona) and limits. Coaches make the day's call (on,
      extra care, land, cancelled) and start/clear lightning holds with a
      30-minute countdown; both alert everyone and show on home.
- [x] Emergency info (2026-09-28, 0088): contacts, allergies, medications,
      notes on each profile; only self, guardians, coaches, admins (RLS via
      can_act_for). Coach > Emergency Info: tap-to-call list, on-the-water
      first, missing contacts flagged.
- [x] Paperwork (2026-09-28, 0089): USRowing membership, waiver, swim test
      (rowers/coxes), SafeSport and background check (coaches/admins). Coach
      > Paperwork shows who needs attention; members update theirs on the
      profile; a coach/admin save marks it checked. Reminders 30 days before
      and on the day.

## Coaching tools
- [x] Seat racing (2026-09-28, 0091): Coach > Seat Racing. Two boats, tap
      rowers in, enter times, pick one from each boat to swap; each swap's
      swing and a running net per rower.
- [x] Boat usage (2026-09-28, 0093): each On the Water outing's distance
      from its GPS track (bad fixes skipped); Boats page shows outings, km,
      hours per boat over 12 months and km since service with a service
      interval and "Serviced today".

## Regatta management (separate product, later)
- [ ] A regatta management tool for hosting regattas (entries, heat sheets,
      timing, results, referee tools like penalty locations and marshaling)
      — Todd is a certified USRowing referee. Build separately from
      BoathouseOS, not inside it.

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
- [x] Automated tests (2026-09-27): Vitest (`npm test`, tests/) covering
      money math, discounts, installments, alert switches, push-endpoint
      allowlist, calendar repeats/standing practices, CrewTimer parsing and
      race categories. GitHub Actions (.github/workflows/ci.yml) runs
      typecheck + lint + tests on every push.
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
- [x] Demo: pick a type of user (2026-09-27): after picking a club, demo
      visitors pick Admin, Coach, Rower, Coxswain or Parent on
      /choose-profile and are signed into that shared demo account
      (lib/demoAccount.ts DEMO_PROFILES; each created the first time it's
      picked, role/removal put back on every sign-in, the demo parent is
      linked to the demo rower). "Viewing as … · Switch" on home.
- [x] Demo clubs (2026-09-27): added the 48 new clubs from the 2026 Head
      of the Ohio entry list (95 total), blades from RegattaCentral.
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
- [x] Role decisions (2026-09-27):
      - Global admin (Todd) sees every club's data, always — no "switch
        into a club" step. The privacy policy and Terms must say so before
        other clubs sign up (BoathouseOS staff can access club data for
        support).
      - One club per account: someone in two clubs uses two logins.
      - How new clubs get created: not decided yet — Todd wants more setup
        and testing done before rolling multi-club out.
- [ ] Before starting Phase 1: refresh ~/.claude/plans/deep-snuggling-kahn.md,
      written when the app had ~20 tables; ~40 have been added since
      (payments, apparel, On the Water, polls, coach tasks, races, push,
      scheduled alerts, photo likes/comments, erg times, ...), each needing
      club_id + RLS. Also the demo's existing per-club `club_slug` on
      races/lineups should fold into the real club_id.

## Maintenance requests
- [x] Boat Maintenance: anyone can report an issue with a specific fleet boat
      (picks from the boat list); coaches/admins see all requests, can mark
      resolved/reopen or delete
- [x] Site Maintenance: same flow for boathouse/facility issues, no boat
      picker needed

## Terms and Conditions
- [ ] Terms are PAUSED for testing (2026-09-27): `TERMS_REQUIRED = false` in
      lib/terms.ts turns off the agree pop-up and the signup checkbox (the
      /terms page stays up). Set it back to true before real clubs sign up;
      anyone who joined while paused gets the pop-up then.
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
      subscription cancelled after the last one). The payer always covers
      the card fee (2026-09-28; the club-covers option was removed). A 1% "Convenience fee"
      is added on top for the payer and goes to BoathouseOS as the
      application fee. Signed webhook at /api/stripe/webhook.
- [x] Apparel (/apparel): in-stock items with per-size counts, and order
      windows with a deadline and a size-by-size list for the vendor; mark
      paid (cash/check), picked up, cancelled. External team store link
      stays on /store.
- [ ] 1. Create a Stripe account at stripe.com, then add STRIPE_SECRET_KEY
      (the sk_test_ key first) and STRIPE_WEBHOOK_SECRET to Vercel and
      .env.local. Nothing charges real money until live keys go in.
      Paused 2026-09-28: account, Connect, webhook and STRIPE_WEBHOOK_SECRET
      are done, but Vercel's STRIPE_SECRET_KEY holds the publishable pk_test_
      key ("cannot be made with a publishable API key" on Connect Stripe).
      Replace it with the sk_test_ secret key, redeploy, then Connect Stripe
      as admin. Not in .env.local yet either.
- [ ] 2. In Stripe, add a webhook for "events on connected accounts" pointing
      at https://boathouseos.app/api/stripe/webhook, sending
      checkout.session.completed, invoice.paid, invoice.payment_failed,
      charge.refunded and
      account.updated. Its signing secret is STRIPE_WEBHOOK_SECRET. Then
      connect the club on Manage payments and test end to end in test mode.
- [ ] 3. Before going live, check card-network and state rules with Stripe or
      an advisor: a percentage convenience fee (networks generally expect a
      flat one) and payer-covered card fees (surcharging: disclosure, caps,
      not allowed on debit cards, restricted in some states).
- [x] 4. Terms and refund policy drafted 2026-09-27 (see Terms and
      Conditions) — lawyer review and the convenience-fee refund decision
      still open.
- [x] Payment reminders and failed-installment alerts — as push alerts
      (2026-09-27, see Scheduled alerts under Infra). Emails not built.
- [ ] Clubs pay BoathouseOS: Stripe Billing subscription tiered by roster
      size, after multi-club Phase 1.

