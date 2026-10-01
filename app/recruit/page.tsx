import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/login/actions";
import { SIDE_LABEL } from "@/lib/recruiting";
import { listedAthletes, recruitViewer } from "@/lib/recruitServer";
import { StorageImage } from "@/components/StorageImage";

export const metadata: Metadata = { title: "College recruiting — BoathouseOS" };

const button = "bg-[#022e5d] text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90";

// College coaches' front page: what this is (signed out), where their
// signup stands, or, once approved, the athletes listed for them.
export default async function RecruitPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; role?: string; side?: string; q?: string }>;
}) {
  const viewer = await recruitViewer();

  if (!viewer) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-4">
        <h1 className="text-3xl font-bold">College recruiting</h1>
        <p className="text-gray-700">
          For college rowing coaches: see high school and club rowers and coxswains whose clubs use BoathouseOS
          and who chose to be listed, with the erg times, grad year and other details they picked to share. To get
          in touch, send a message to their club coach and parents.
        </p>
        <ul className="list-disc pl-5 text-sm text-gray-600 flex flex-col gap-1">
          <li>Only coaches with a school (.edu) email, checked by BoathouseOS.</li>
          <li>Athletes choose what&apos;s shown, and a parent approves for anyone under 18.</li>
          <li>No phone numbers, emails, addresses or birthdays, ever.</li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <Link href="/recruit/signup" className={button}>
            Sign up
          </Link>
          <Link href="/recruit/login" className="border-2 border-[#022e5d] text-[#022e5d] rounded-lg px-4 py-2 text-sm font-medium">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const r = viewer.recruiter;
  if (!r || r.status !== "approved") {
    const [title, body] = !r
      ? [
          "This isn't a college coach's account",
          "These pages are for college coaches. Club members sign in at their club's own address.",
        ]
      : r.status === "pending"
        ? [
            "Waiting for approval",
            `Thanks, ${r.name}. A BoathouseOS admin is checking your details for ${r.school}. You'll get an email when you can see athletes.`,
          ]
        : ["Not approved", "We couldn't confirm your details. If you think that's a mistake, email privacy@boathouseos.app."];
    return (
      <main className="max-w-md mx-auto px-4 py-16 flex flex-col gap-4 text-center">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-gray-600">{body}</p>
        <form action={signOut}>
          <button type="submit" className={button}>
            Sign out
          </button>
        </form>
      </main>
    );
  }

  const { year, role, side, q } = await searchParams;
  const all = await listedAthletes(createAdminClient());
  const years = [...new Set(all.map((a) => a.gradYear).filter((y): y is number => !!y))].sort();
  const search = (q ?? "").trim().toLowerCase();
  const athletes = all
    .filter((a) => !year || String(a.gradYear ?? "") === year)
    .filter((a) => !role || a.role === role)
    .filter((a) => !side || a.side === side)
    .filter(
      (a) =>
        !search ||
        [a.name, a.clubName, a.highSchool, a.intendedMajor].some((t) => t?.toLowerCase().includes(search))
    )
    .sort((a, b) => (a.gradYear ?? 9999) - (b.gradYear ?? 9999) || a.name.localeCompare(b.name));

  const select = "border rounded px-2 py-2 text-sm bg-white";
  return (
    <main className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Athletes</h1>
        <p className="text-sm text-gray-500">
          {r.name}, {r.school} · {all.length} listed
        </p>
      </div>

      <form className="flex flex-wrap gap-2 items-center">
        <input name="q" defaultValue={q} placeholder="Name, club, school, major" className={`${select} flex-1 min-w-48`} />
        <select name="year" defaultValue={year ?? ""} className={select}>
          <option value="">Any grad year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select name="role" defaultValue={role ?? ""} className={select}>
          <option value="">Rowers and coxswains</option>
          <option value="rower">Rowers</option>
          <option value="coxswain">Coxswains</option>
        </select>
        <select name="side" defaultValue={side ?? ""} className={select}>
          <option value="">Any side</option>
          {Object.entries(SIDE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className={button}>
          Filter
        </button>
      </form>

      {athletes.length === 0 ? (
        <p className="text-sm text-gray-500">No athletes match.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {athletes.map((a) => (
            <li key={a.id}>
              <Link
                href={`/recruit/${a.id}`}
                className="bg-white border border-gray-200 rounded-lg p-3 flex gap-3 hover:border-[#022e5d]"
              >
                <div className="relative w-16 h-16 shrink-0 rounded-full overflow-hidden bg-gray-100">
                  {a.photoUrl && <StorageImage src={a.photoUrl} alt="" fill sizes="64px" className="object-cover" />}
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold truncate">{a.name}</p>
                  <p className="text-gray-500 truncate">
                    {[a.role === "coxswain" ? "Coxswain" : "Rower", a.gradYear ? `Class of ${a.gradYear}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-gray-500 truncate">{a.clubName}</p>
                  {(a.erg2k || a.side) && (
                    <p className="text-gray-700 truncate">
                      {[a.erg2k ? `2K ${a.erg2k}` : null, a.side ? SIDE_LABEL[a.side] : null].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
