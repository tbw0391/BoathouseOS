import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy — BoathouseOS",
};

// Public (see middleware.ts). Keep this in step with what the app actually
// collects: new profile fields, tables, cookies, or outside services that
// receive data should be reflected here.
const CONTACT_EMAIL = "privacy@boathouseos.app";
const LAST_UPDATED = "October 1, 2026";

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
            <strong>Club activity:</strong> lineups, practice check-ins and absences, erg time
            history, food tent and volunteer signups, poll votes, suggestions, maintenance reports,
            messages, and photos (including who is tagged in them).
          </li>
          <li>
            <strong>Text alerts (only if you turn them on):</strong> your mobile number, the
            consent wording you agreed to and when, and whether you&apos;ve replied STOP.
          </li>
          <li>
            <strong>Emergency and medical information:</strong> emergency contacts, allergies,
            medications, and medical notes a member or their parent chooses to add, so coaches can
            act quickly on the water.
          </li>
          <li>
            <strong>Race-day and travel details:</strong> bow numbers, who&apos;s riding in which
            car or bus and who&apos;s driving, hotel rooming lists, and who packed what on the
            trailer.
          </li>
          <li>
            <strong>Calendar link:</strong> a private link for adding the club schedule to your
            phone&apos;s calendar, which you can replace at any time.
          </li>
          <li>
            <strong>Concept2 Logbook (only if you connect it):</strong> read-only access to a
            rower&apos;s Concept2 Logbook and the erg pieces it sends. You can disconnect it at any
            time.
          </li>
          <li>
            <strong>Payments:</strong> what your club has billed you, what you&apos;ve paid and
            how (cash, check, or card), and apparel orders. Card numbers go straight to Stripe;
            BoathouseOS never sees or stores them.
          </li>
          <li>
            <strong>Agreeing to the terms:</strong> when you agreed to the terms of service and
            this policy at signup.
          </li>
          <li>
            <strong>On-water location:</strong> only while a coxswain has started on-water
            tracking during a practice, their phone&apos;s GPS position is recorded so the club can
            see where the boat is. Tracking stops when the session ends, and the phone asks for
            permission first.
          </li>
          <li>
            <strong>&quot;Interested&quot; form:</strong> the name, club, email, and phone number
            you choose to leave.
          </li>
          <li>
            <strong>Club website forms:</strong> when someone uses a club&apos;s public website to
            send a message or ask to join, the name, email, phone number and message they enter.
          </li>
          <li>
            <strong>Program registration:</strong> when a family registers for a camp, Learn to Row
            or other program on a club&apos;s website, the participant&apos;s name and birth date; a
            parent or guardian&apos;s name, email and phone number; an emergency contact; any
            allergies, medications or medical notes they choose to give; their answers to the
            club&apos;s questions; whether they agreed to the club&apos;s waiver and when; and
            whether the club has marked it paid. The person registering doesn&apos;t need an
            account.
          </li>
          <li>
            <strong>Forms and surveys:</strong> answers members give to their club&apos;s forms,
            including any files they upload.
          </li>
          <li>
            <strong>Elections:</strong> whether a member voted in a club election, and the votes
            cast. Ballots are stored without the voter&apos;s name or the time, so no one,
            including the club and BoathouseOS, can see how a person voted.
          </li>
          <li>
            <strong>Network address:</strong> the IP address of signup, &quot;interested&quot;
            form, club website form and program registration submissions, used only to block spam
            and abuse.
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
          anything until a club admin approves them. Some things are narrower: while a boat is on
          the water, club members can see where it is right now, but its full track and past
          outings are visible only to coaches, admins, and the coxswain who recorded them; bills and
          payments only to the family involved and the club&apos;s treasurer and admins; erg time
          history and attendance only to the member and their coaches; emergency and medical
          information only to the member, their parents or guardians, coaches, and admins; and &quot;interested&quot;
          form submissions only to the BoathouseOS team. BoathouseOS&apos;s own staff can see and
          change any club&apos;s information, but only to run the service, help a club that asks,
          fix problems, or keep it secure.
        </p>
        <p>
          A club&apos;s public website only shows what the club chooses to publish there, such as
          regatta dates, results by boat (never rowers&apos; names), and coaches&apos; and board
          members&apos; names, titles and photos. It never shows members&apos; contact details or
          anything about minors. Messages and program registrations sent through a club&apos;s
          website are visible only to that club&apos;s admins; the club&apos;s coaches can also see
          registrations, including emergency contacts and medical notes. Answers to a club form are
          visible to the person who answered and to whoever made the form, plus the club&apos;s
          admins and board members. In an election, they can see who has voted but not how; the
          vote totals are shown to the members the election is for after voting closes.
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
        <p>
          Program registrations on a club&apos;s website are usually made by a parent or guardian
          for their child. The club uses that information only to run the program and keep
          participants safe, and a parent or guardian can ask the club, or us, to correct or delete
          it.
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
            <strong>Resend</strong> delivers the app&apos;s emails: password resets, alerts (to
            members who haven&apos;t turned on phone alerts), program registration confirmations,
            messages from club website forms to the club&apos;s admins, and announcements from
            BoathouseOS. It receives the email address and the message&apos;s text.
          </li>
          <li>
            <strong>Twilio</strong> sends text alerts to members who turned them on and receives
            the mobile number and the alert&apos;s text. Mobile numbers and text-alert consent are
            never sold, rented, or shared with anyone for marketing, and aren&apos;t shared with
            other third parties except Twilio to send the texts.
          </li>
          <li>
            <strong>Stripe</strong> processes card payments for your club. When you pay by card,
            Stripe receives your card details and the payment amount, and your club&apos;s Stripe
            account records the payment. Stripe&apos;s own privacy policy covers what it does
            with them.
          </li>
          <li>
            <strong>Concept2</strong> sends the erg pieces from a Logbook a member connects.
            BoathouseOS keeps the read-only access Concept2 grants until it&apos;s disconnected, and
            sends Concept2 nothing about anyone.
          </li>
          <li>
            To show race-day weather and water conditions, the{" "}
            <strong>National Weather Service</strong>, the <strong>U.S. Geological Survey</strong>{" "}
            (river gauges), and <strong>OpenStreetMap</strong> receive a regatta&apos;s or river
            gauge&apos;s location, never anything about a person. Maps load their tiles from OpenStreetMap, which sees your IP address as any
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
          The app uses a sign-in cookie to keep you signed in, a cookie to remember which
          club&apos;s colors to show, and, if you turn on alerts, a cookie that lets signing out
          stop alerts on that device. Turning on alerts saves an address your phone&apos;s push
          service (Apple, Google, or Mozilla) gives us for sending them; alert text passes
          through that service. When installed on a phone, it also saves copies of pages
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
        <p>
          Program registrations and website messages are kept until the club deletes them or asks
          us to. When a club deletes a form or program, its answers, uploaded files and
          registrations are deleted too.
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
        {" · "}
        <Link href="/terms" className="underline">
          Terms of service
        </Link>
      </p>
    </div>
  );
}
