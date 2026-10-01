import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_CONTACT_EMAIL, TERMS_LAST_UPDATED } from "@/lib/terms";

export const metadata: Metadata = {
  title: "Terms of service — BoathouseOS",
};

// Public (see middleware.ts). Plain-language draft; have it reviewed by a
// lawyer before real clubs sign up. When it changes in a way members should
// re-agree to, bump TERMS_VERSION in lib/terms.ts.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-6 text-sm leading-relaxed text-gray-800">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Terms of service</h1>
        <p className="text-gray-500 mt-1">Last updated {TERMS_LAST_UPDATED}</p>
      </div>

      <p>
        BoathouseOS is an app rowing clubs use to run their program. These terms cover using it,
        whether you&apos;re a club running it or a member using your club&apos;s account. By
        creating an account or using the app, you agree to these terms and to our{" "}
        <Link href="/privacy" className="underline">
          privacy policy
        </Link>
        . Questions go to{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline">
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </p>

      <Section title="Clubs and members">
        <p>
          Each club decides who belongs to it: its admins approve new signups, set people&apos;s
          roles, and can remove members. The club is responsible for its roster, for what its
          admins and coaches do in the app, and for having any permissions it needs (for example,
          from parents) for the information and photos it keeps about its members.
        </p>
        <p>
          A club&apos;s waivers, program rules, and other forms are the club&apos;s own.
          BoathouseOS only records that someone agreed to them and when.
        </p>
        <p>
          BoathouseOS can pause a club&apos;s access if the club breaks these terms. While
          it&apos;s paused, the club&apos;s members can&apos;t use the app, but nothing is deleted,
          and everything comes back when the pause is lifted.
        </p>
      </Section>

      <Section title="Your account">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Use your real name and keep your details accurate.</li>
          <li>One account per person. Don&apos;t share your password or sign in as someone else.</li>
          <li>
            You&apos;re responsible for what happens under your account. Tell your club admin
            right away if you think someone else has used it.
          </li>
        </ul>
      </Section>

      <Section title="Rowers under 18">
        <p>
          Children under 13 shouldn&apos;t sign up for themselves; a parent or guardian, or the
          club, should set up and manage their profile. Members from 13 to 17 need a parent or
          guardian&apos;s permission to use the app. Parents and guardians can see and manage their
          child&apos;s information as described in the privacy policy.
        </p>
      </Section>

      <Section title="Using the app respectfully">
        <p>Don&apos;t use BoathouseOS to:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>harass, bully, threaten, or discriminate against anyone;</li>
          <li>
            post anything sexual, violent, or otherwise inappropriate for a youth sports team;
          </li>
          <li>share someone else&apos;s private information without their permission;</li>
          <li>
            post photos or other content you don&apos;t have the right to share, or that go
            against your club&apos;s photo rules;
          </li>
          <li>send spam or advertising;</li>
          <li>
            try to get into accounts or data you aren&apos;t meant to see, or interfere with how
            the app works.
          </li>
        </ul>
        <p>
          Your club&apos;s own rules, including any Safe Sport policies on communicating with
          minors, apply on top of these terms.
        </p>
      </Section>

      <Section title="What you post">
        <p>
          Messages, photos, and anything else you add stay yours. You let BoathouseOS store it and
          show it to your club as the app is designed to, and nothing more. BoathouseOS staff can
          also see it when needed to support your club, fix problems, or keep the app secure.
          Your club&apos;s admins
          and coaches can remove content from their club. We can remove content, or suspend an
          account, that breaks these terms.
        </p>
      </Section>

      <Section title="Payments">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>
            Dues, fees, and apparel are charged by your club, and card payments go to the
            club&apos;s own Stripe account. Stripe processes the card; BoathouseOS never sees or
            stores your card number.
          </li>
          <li>
            Before you pay, the app shows the total, including the card processing fee and
            BoathouseOS&apos;s convenience fee.
          </li>
          <li>
            If you choose a payment plan, the remaining payments are charged to your card
            automatically on the dates shown until the plan is done.
          </li>
          <li>
            Refunds are up to your club. Ask your club&apos;s treasurer, who issues refunds from
            the club&apos;s Stripe account. The convenience fee is not refunded unless the club or
            BoathouseOS chooses to refund it.
          </li>
          <li>
            Questions about what you owe go to your club, not BoathouseOS.
          </li>
        </ul>
      </Section>

      <Section title="On the Water is not a safety system">
        <p>
          On-water tracking shows roughly where boats are, when a coxswain&apos;s phone has a
          signal and the app is open. It can be late, inaccurate, or stop working. Don&apos;t rely
          on it for safety: follow your club&apos;s safety plan, launch rules, and coaches&apos;
          instructions.
        </p>
      </Section>

      <Section title="Text message alerts">
        <p>
          Text alerts are optional. If you turn them on from your profile, BoathouseOS texts your
          mobile number for your club&apos;s urgent alerts: lightning holds, changes to
          today&apos;s practice, and race launch times. Message frequency varies (usually a few a
          week in season). Message and data rates may apply. Reply <strong>STOP</strong> to any
          text to stop them, or <strong>HELP</strong> for help; you can also turn them off on your
          profile. Agreeing isn&apos;t a condition of membership. Rowers and coxswains under 18
          don&apos;t get texts themselves; their parents or guardians can turn them on for their
          own phones. Carriers aren&apos;t liable for delayed or undelivered messages, and texts
          can be late or missed, so don&apos;t rely on them alone for safety.
        </p>
      </Section>

      <Section title="The demo">
        <p>
          The public demo uses made-up data and a shared account. Anyone can see what you type in
          it, and it gets wiped regularly. Don&apos;t put real personal information there.
        </p>
      </Section>

      <Section title="The service itself">
        <p>
          We work to keep BoathouseOS running and your data safe, but the app is provided as it
          is, without promises that it will always be available or free of mistakes. We may add,
          change, or remove features. Rowing and race-day information in the app (schedules,
          lineups, results, weather) is there for convenience; check official sources for anything
          that matters.
        </p>
        <p>
          To the extent the law allows, BoathouseOS isn&apos;t liable for indirect or
          consequential losses from using the app, and our total liability to you is limited to
          what you paid BoathouseOS (the convenience fees) in the twelve months before the claim.
        </p>
      </Section>

      <Section title="Leaving">
        <p>
          You can stop using BoathouseOS at any time, and ask us to delete your information as the
          privacy policy describes. Your club can remove you from its roster. We can suspend or
          close an account that breaks these terms, and a club&apos;s access ends if it stops
          using BoathouseOS.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These terms are governed by the laws of the State of Ohio. Any dispute about them goes
          to the state or federal courts in Franklin County, Ohio.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If these terms change, we&apos;ll update the date at the top. For a bigger change, we
          may ask you to agree again the next time you sign up or sign in.
        </p>
      </Section>

      <p className="text-gray-500">
        <Link href="/" className="underline">
          Back to BoathouseOS
        </Link>
        {" · "}
        <Link href="/privacy" className="underline">
          Privacy policy
        </Link>
      </p>
    </div>
  );
}
