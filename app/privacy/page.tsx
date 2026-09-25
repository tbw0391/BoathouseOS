import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy — BoathouseOS",
};

// Public (see middleware.ts). Keep this in step with what the app actually
// collects: new profile fields, tables, cookies, or outside services that
// receive data should be reflected here.
const CONTACT_EMAIL = "privacy@boathouseos.app";
const LAST_UPDATED = "September 25, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-6 text-sm leading-relaxed text-gray-800">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Privacy policy</h1>
        <p className="text-gray-500 mt-1">Last updated {LAST_UPDATED}</p>
      </div>

      <p>
        BoathouseOS is an app rowing clubs use to run their program: roster, schedule, lineups,
        race day, volunteers, and team messaging. This page explains what information the app
        keeps, who can see it, and how to get it removed. Questions go to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <Section title="The demo">
        <p>
          The public demo at boathouseos.app uses made-up sample data and one shared demo account.
          Anything you type into the demo can be seen by other visitors and is wiped when the demo
          is reset. Please don&apos;t enter real personal information there.
        </p>
      </Section>

      <Section title="What we collect">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>
            <strong>Account and profile:</strong> name, email, role (rower, coxswain, parent,
            coach, admin), teams, and whatever a member or their club chooses to add: phone,
            address, birthday, photo, high school and graduation year, erg times, weight, boat
            side, US Rowing number, a fun fact, and a walk-up song.
          </li>
          <li>
            <strong>Family links:</strong> which parents or guardians are connected to which
            rowers, and spouse links between parents.
          </li>
          <li>
            <strong>Club activity:</strong> lineups, schedule RSVPs, food tent and volunteer
            signups, poll votes, suggestions, maintenance reports, messages, and photos (including
            who is tagged in them).
          </li>
          <li>
            <strong>On-water location:</strong> only while a coxswain has started on-water
            tracking during a practice, their phone&apos;s GPS position is recorded so coaches can
            see where the boat is. Tracking stops when the session ends, and the phone asks for
            permission first.
          </li>
          <li>
            <strong>&quot;Interested&quot; form:</strong> the name, club, email, and phone number
            you choose to leave.
          </li>
          <li>
            <strong>Network address:</strong> the IP address of signup and &quot;interested&quot;
            form submissions, used only to block spam and abuse.
          </li>
        </ul>
        <p>
          We don&apos;t use advertising or analytics trackers, and we don&apos;t sell or rent
          anyone&apos;s information.
        </p>
      </Section>

      <Section title="Who can see it">
        <p>
          Your information is visible to the approved members of your own club, as the app&apos;s
          screens show it (for example, the roster and bio pages). New signups can&apos;t see
          anything until a club admin approves them. Some things are narrower: on-water locations
          are visible only to coaches, admins, and the coxswain who recorded them, and &quot;interested&quot; form submissions only
          to the BoathouseOS team.
        </p>
      </Section>

      <Section title="Rowers under 18">
        <p>
          Many rowers are minors. Their information is entered by the rower, a parent or guardian,
          or the club, for running the club&apos;s program only. BoathouseOS isn&apos;t meant for
          children under 13 to sign up for themselves; a club with younger members should have a
          parent or guardian set up and manage that member&apos;s profile. A parent or guardian can
          ask us to see, correct, or delete their child&apos;s information at any time.
        </p>
      </Section>

      <Section title="Services that handle the data">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>
            <strong>Supabase</strong> stores the database, sign-ins, and uploaded photos (United
            States).
          </li>
          <li>
            <strong>Vercel</strong> hosts the app and keeps short-lived server logs.
          </li>
          <li>
            To show race-day weather, the <strong>National Weather Service</strong> and{" "}
            <strong>OpenStreetMap</strong> receive a regatta&apos;s location, never anything about
            a person. Maps load their tiles from OpenStreetMap, which sees your IP address as any
            website would.
          </li>
          <li>
            Race results are read from <strong>CrewTimer</strong>&apos;s public results; nothing is
            sent to them.
          </li>
        </ul>
      </Section>

      <Section title="Cookies and storage on your device">
        <p>
          The app uses a sign-in cookie to keep you signed in and a cookie to remember which
          club&apos;s colors to show. When installed on a phone, it also saves copies of pages
          so it loads quickly; those are cleared when you sign out.
        </p>
      </Section>

      <Section title="Keeping and deleting information">
        <p>
          When a club removes someone from its roster, their access ends right away, but their
          history (like past lineups and messages) is kept so the club can restore them later. To
          have your information, or your child&apos;s, permanently deleted, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>{" "}
          and we&apos;ll take care of it. You can also ask for a copy of what&apos;s stored about
          you, or edit most of your profile yourself in the app.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes, we&apos;ll update the date at the top of this page. For a change
          that affects how existing information is used, we&apos;ll tell clubs before it takes
          effect.
        </p>
      </Section>

      <p className="text-gray-500">
        <Link href="/" className="underline">
          Back to BoathouseOS
        </Link>
      </p>
    </div>
  );
}
