# W-Crew-app Backlog

## Roster
- [x] Read-only roster list (name, role, boat side, phone, email)
- [x] Add member form (admin/coach)
- [x] Bio page per member (address, phone, birthday, high school, grad year,
      fun fact, photo, 2K/5K erg time, team, board member flag)
- [x] Edit member profile (self, or coach/admin)
- [ ] Disable/remove member
- [ ] Signup flow so new members can self-register (currently accounts are created manually in Supabase)

## Schedule
- [ ] List upcoming events (practice, regatta, meeting, other)
- [ ] Create/edit event (coach/admin), including recurrence (weekly/monthly/yearly)
- [ ] RSVP (attending / not attending) per event
- [ ] Calendar view

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
- [ ] New PR banner (celebrate a new 2K/5K erg PR)

## Infra / cross-cutting
- [ ] Real app icons (replace placeholder "WC" PNGs) — club branding/logo
- [ ] Nav bar / bottom tab bar instead of home-page button grid once there are more screens
- [ ] Role-based UI (hide admin-only actions from rowers/parents)
- [ ] Push notifications for new messages / schedule changes (PWA)
- [ ] Deploy (Vercel) + point a real domain
