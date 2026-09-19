import Link from "next/link";

const sections = [
  { href: "/roster", label: "Roster" },
  { href: "/schedule", label: "Schedule" },
  { href: "/lineups", label: "Lineups" },
  { href: "/workouts", label: "Workouts" },
  { href: "/volunteer", label: "Volunteer Needs" },
  { href: "/store", label: "Team Store" },
  { href: "/messages", label: "Messages" },
];

export default function Home() {
  return (
    <div className="min-h-screen p-8 flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">W-Crew-app</h1>
        <p className="text-sm text-gray-500">Westerville Rowing Club</p>
      </div>

      <div className="w-full max-w-md grid grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center justify-center text-center rounded-lg border px-4 py-6 font-medium hover:bg-black hover:text-white transition-colors"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
