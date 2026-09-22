import Link from "next/link";
import { Sailboat, Dumbbell } from "lucide-react";
import { MarkViewed } from "./MarkViewed";

export default function SchedulePage() {
  return (
    <div className="min-h-screen p-8">
      <MarkViewed />
      <h1 className="text-2xl font-bold mb-6">Schedule</h1>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Link
          href="/schedule/regatta"
          className="flex flex-col items-center justify-center gap-2 text-center rounded-lg border-2 border-[var(--color-primary)] px-4 py-8 font-medium hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
        >
          <Sailboat className="w-6 h-6" />
          Regattas
        </Link>
        <Link
          href="/schedule/practice"
          className="flex flex-col items-center justify-center gap-2 text-center rounded-lg border-2 border-[var(--color-primary)] px-4 py-8 font-medium hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
        >
          <Dumbbell className="w-6 h-6" />
          Practice
        </Link>
      </div>
    </div>
  );
}
