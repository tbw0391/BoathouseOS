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
- [ ] Group chat list
- [ ] Send/receive messages in a group
- [ ] Unread counts
- [ ] Direct messages
- [ ] Auto-add members to the matching team message group when their team
      changes (e.g. added to Men's -> auto-joined to Men's group chat)

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
- [ ] Push notifications for new messages / schedule changes (PWA)
- [ ] Deploy (Vercel) + point a real domain
