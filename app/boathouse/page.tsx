import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clubDateKey } from "@/lib/raceDay";
import { clubDateTime } from "@/lib/ical";
import type { BoathouseBoat, Erg, Reservation, SignOut } from "@/lib/boathouse";
import { LogbookTab, BookTab, SettingsTab, type Person } from "./BoathouseTabs";

export const dynamic = "force-dynamic";

// Boathouse (0128): who's on the water and the sign-out logbook, boat and
// erg bookings, and (coaches/admins) which boats members can take, ergs and
// rower ratings.
export default async function BoathousePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; date?: string }>;
}) {
  const { tab: tabParam, date: dateParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = clubDateKey(new Date());
  const day = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const dayStart = clubDateTime(day, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600000);

  const [{ data: meRow }, { data: boatRows }, { data: ergRows }, { data: peopleRows }, { data: ratingRows }, { data: outRows }, { data: recentRows }, { data: dayRows }, { data: mineRows }] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase.from("boats").select("id, name, boat_class, bookable, min_rating, out_of_service").order("name"),
      supabase.from("ergs").select("id, name, bookable, out_of_service, notes").order("name"),
      supabase
        .from("profiles")
        .select("id, display_name, role")
        .in("role", ["rower", "coxswain", "coach", "admin"])
        .is("disabled_at", null)
        .not("approved_at", "is", null)
        .order("display_name"),
      supabase.from("member_ratings").select("profile_id, rating"),
      supabase.from("boat_signouts").select("*").is("back_at", null).order("out_at"),
      supabase.from("boat_signouts").select("*").not("back_at", "is", null).order("out_at", { ascending: false }).limit(25),
      supabase
        .from("boat_reservations")
        .select("*")
        .lt("starts_at", dayEnd.toISOString())
        .gt("ends_at", dayStart.toISOString())
        .order("starts_at"),
      supabase
        .from("boat_reservations")
        .select("*")
        .gt("ends_at", new Date().toISOString())
        .or(`booked_by.eq.${user.id},rower_ids.cs.{${user.id}}`)
        .order("starts_at")
        .limit(20),
    ]);

  const role = (meRow as { role: string } | null)?.role ?? "";
  const isStaff = role === "coach" || role === "admin";
  const ratings = Object.fromEntries(
    ((ratingRows as { profile_id: string; rating: number }[] | null) ?? []).map((r) => [r.profile_id, r.rating])
  );
  const people: Person[] = ((peopleRows as { id: string; display_name: string; role: string }[] | null) ?? []).map(
    (p) => ({ id: p.id, name: p.display_name, role: p.role, rating: ratings[p.id] ?? 0 })
  );
  const boats = (boatRows as BoathouseBoat[] | null) ?? [];
  const ergs = (ergRows as Erg[] | null) ?? [];
  const out = (outRows as SignOut[] | null) ?? [];
  const recent = (recentRows as SignOut[] | null) ?? [];
  const dayReservations = (dayRows as Reservation[] | null) ?? [];
  const mine = (mineRows as Reservation[] | null) ?? [];

  const tab = tabParam === "book" || (tabParam === "settings" && isStaff) ? tabParam : "logbook";
  const tabs = [
    { id: "logbook", label: "Logbook" },
    { id: "book", label: "Book" },
    ...(isStaff ? [{ id: "settings", label: "Settings" }] : []),
  ];

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold">Boathouse</h1>
      <p className="text-sm text-gray-600 mt-1">
        Sign boats out and back in, and book a boat or an erg.
      </p>
      <nav className="mt-4 flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.id === "logbook" ? "/boathouse" : `/boathouse?tab=${t.id}`}
            className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                : "border-gray-300 hover:border-[var(--color-primary)]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "logbook" && (
          <LogbookTab meId={user.id} isStaff={isStaff} boats={boats} people={people} out={out} recent={recent} />
        )}
        {tab === "book" && (
          <BookTab
            meId={user.id}
            isStaff={isStaff}
            boats={boats}
            ergs={ergs}
            people={people}
            day={day}
            today={today}
            dayReservations={dayReservations}
            mine={mine}
          />
        )}
        {tab === "settings" && isStaff && <SettingsTab boats={boats} ergs={ergs} people={people} />}
      </div>
    </div>
  );
}
