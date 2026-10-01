# USRowing RefCorps: evaluation (2026-10-01)

Research notes for any BoathouseOS session that works on referee features.
Everything below comes from USRowing's **public** pages. The logged-in
RefCorps portal hasn't been looked at yet; see "To check while logged in"
at the end.

## What RefCorps is

- Login: https://usrowing.my.site.com/refcorps/s/login/
- A Salesforce Experience Cloud community site (Aura/"siteforce" pages
  under `*.my.site.com`). It has no public API, and every page needs a login.
- From the [Referee Resources](https://usrowing.org/referees/referee-resources)
  page, referees use it to:
  - log the regattas they worked and the position held at each
  - record attendance at the annual clinic
  - track SafeSport and background check dates
  - see open regattas and say which ones they'd like to work
  - record observations (candidates and level-ups)
  - set preferences for National Championships
- **Annual data call:** at the end of each year every referee must have
  everything entered to keep their license.

## Referee stages ([Referee Stages](https://usrowing.org/referees/referee-stages))

| Stage | Requirements | Minimum per year |
|---|---|---|
| Candidate | interest form, USRowing membership, SafeSport, background check, Referee College online course | — |
| Level 1 | licensed, mentored by a Regional Coordinator | 1 regatta day |
| Level 2 | "Meet Standards" observations in every position, supervised work, letter from an L2/L3, written Rules & Procedures exam | 4 regatta days |
| Level 3 | varied roles and regions, supervisory duties | 8 regatta days at geographically distinct venues |

Referees can move up or down a level based on availability, without
re-certifying. Older pages (archive.usrowing.org, 2017 news) describe a
replaced system ("Assistant Referee", 14 regattas before the exam); don't
build from those.

Other facts:
- [Sanction a Regatta](https://usrowing.org/sanction-a-regatta): every
  sanctioned regatta except duals/tris needs a fully licensed Chief Referee.
- [Clinics](https://usrowing.org/referees/referee-clinic-overview):
  Basic Skills, Advanced Referee Skills, Chief Referee School. Dates come
  from your Regional Coordinator.
- [Referee Committee](https://usrowing.org/referees/referee-committee):
  six Regional Coordinators (NE, Mid-Atlantic, SE, Midwest, SW, NW), the
  Referee College, at-large members and a staff liaison.

## RefCorps is being replaced (important)

[USRowing selects FOYS](https://usrowing.org/news/usrowing-selects-foys-as-new-platform-partner):
the current member and regatta platforms end with 2026.

- Nov/Dec 2026: clubs get early access to **RowingOps** for membership renewal
- Jan 1, 2027: individual members move to it (**MyRowing**)
- Mar 2027: regattas can use RowingOps for regatta management
- Referees manage their profile, availability and event sign-ups in
  MyRowing; RowingOps includes referee and jury assignment
- Referee records since 2019 migrate automatically; the requirements
  don't change
- USRowing says it will offer **APIs** for third-party regatta platforms
  ("real-time, secure updates")
- Oct 21, 2026: "New Member Platform Webinar – Referees"

## What this means for BoathouseOS

- **Don't integrate with RefCorps.** It has no API, scraping a Salesforce
  login is fragile and probably against the terms of use, and it goes
  away within months.
- **Watch the FOYS/RowingOps APIs.** If they open to third parties, they're
  the place to sync referee info. Ask about this at the Oct 21 webinar.
- **Worth building on our side now (if wanted):**
  - a referee's own log: regatta days, position, venue, supervisor; a count
    against the 1/4/8-day minimum; distinct venues for L3; export for the
    data call
  - SafeSport and background check expiry reminders (BoathouseOS already
    tracks SafeSport for members)
  - for a club hosting a regatta: a Chief Referee and referee crew list
    on the regatta's page

## To check while logged in (for a session with Claude in Chrome)

Open https://usrowing.my.site.com/refcorps/s/ while signed in and note,
without changing anything:

1. Main menu and pages: list each with a one-line description.
2. Regatta list: what fields show (name, date, venue, positions needed,
   status) and how "express interest" works.
3. Regatta log: the fields for adding a regatta worked (positions offered,
   days, supervisor, observations).
4. Observations: who writes them, the form fields, the rating scale.
5. Profile and compliance: license level, SafeSport and background check
   dates, clinic attendance.
6. Data call: where it lives and what it asks for.
7. Any export (CSV/PDF) or calendar feed (iCal).
8. Any notice about moving to MyRowing/FOYS.

Add the findings below this list, without personal info (no member
numbers, other referees' names, or contact details).
