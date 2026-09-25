import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Users,
  Calendar,
  Waves,
  Trophy,
  Tent,
  HelpingHand,
  MessageCircle,
  Camera,
  Wrench,
  Palette,
  Smartphone,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { ClearRuntimeCaches } from "@/components/ClearRuntimeCaches";
import { TryDemoButton } from "@/components/TryDemoButton";
import { InterestForm } from "@/app/interest/InterestForm";

export const metadata: Metadata = {
  title: "BoathouseOS — the operating system for rowing programs",
  description:
    "Roster, schedule, lineups, live regatta results, food tent, volunteers, and messaging for your rowing club, in one app.",
};

// What a visiting club sees before signing in (signed-out visitors to "/"
// land here; see middleware.ts). Only list things the demo actually does.
const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Users,
    title: "Roster",
    body: "Rowers, coxswains, parents, and coaches, with bios, erg times, and family links. New members sign up with a QR code and wait for an admin to approve them.",
  },
  {
    icon: Calendar,
    title: "Schedule",
    body: "Practices and regattas in one place, with weather forecasts for race day.",
  },
  {
    icon: Waves,
    title: "Lineups",
    body: "Build boats seat by seat, import races from a heat sheet, and rowers and parents get notified when they're in a boat.",
  },
  {
    icon: Trophy,
    title: "Live regatta results",
    body: "Your club's races, start times, and finishes pulled live from CrewTimer on race day.",
  },
  {
    icon: Tent,
    title: "Food tent",
    body: "Families sign up to bring items. The list auto-fills from the last regatta for the tent leader to review.",
  },
  {
    icon: HelpingHand,
    title: "Volunteers",
    body: "Post the slots you need filled and let parents claim them.",
  },
  {
    icon: MessageCircle,
    title: "Messaging",
    body: "Team group chats and coach announcements to rowers, parents, or both.",
  },
  {
    icon: Camera,
    title: "Photos",
    body: "A shared team album with people tagged.",
  },
  {
    icon: Wrench,
    title: "Boats and maintenance",
    body: "Your fleet list, plus a place for anyone to report a broken rigger before it's a problem.",
  },
];

const HIGHLIGHTS: { icon: LucideIcon; text: string }[] = [
  { icon: Palette, text: "In your club's colors" },
  { icon: Smartphone, text: "Installs on any phone" },
  { icon: ShieldCheck, text: "Admin-approved members only" },
];

export default function WelcomePage() {
  return (
    <div className="min-h-screen px-6 py-10 max-w-3xl mx-auto flex flex-col gap-12">
      <ClearRuntimeCaches />

      <section className="flex flex-col items-center text-center gap-5">
        <Image
          src="/branding/logo-full.png"
          alt="BoathouseOS"
          width={789}
          height={205}
          priority
          className="w-72 max-w-full h-auto"
        />
        <h1 className="text-3xl font-bold leading-tight text-[var(--color-primary)]">
          The operating system for rowing programs
        </h1>
        <p className="text-gray-600 max-w-xl">
          Roster, schedule, lineups, race day, and the parents who keep it all running, in one app
          instead of a dozen group texts and spreadsheets.
        </p>
        <div className="w-full max-w-xs flex flex-col gap-2">
          <TryDemoButton />
          <p className="text-xs text-gray-500">No signup. Look around as a club admin.</p>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-700">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-1.5">
              <Icon className="w-4 h-4 text-[var(--color-primary)]" />
              {text}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="border-2 border-[var(--color-primary)] rounded-lg p-4 flex gap-3">
            <Icon className="w-6 h-6 shrink-0 text-[var(--color-primary)]" />
            <div>
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm text-gray-600 mt-1">{body}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col items-center text-center gap-3">
        <h2 className="text-xl font-bold">Want it for your club?</h2>
        <div className="w-full max-w-md text-left">
          <InterestForm />
        </div>
      </section>

      <p className="text-center text-sm text-gray-500">
        Already a member?{" "}
        <Link href="/login" className="text-[var(--color-primary)] underline">
          Sign in
        </Link>
        {" · "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
      </p>
    </div>
  );
}
