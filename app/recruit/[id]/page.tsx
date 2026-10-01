import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "@/components/ActionForm";
import { StorageImage } from "@/components/StorageImage";
import { SIDE_LABEL } from "@/lib/recruiting";
import { listedAthletes, recruitViewer } from "@/lib/recruitServer";
import { contactAthlete } from "../actions";

// One athlete, as a college coach sees them, and the Contact form.
export default async function RecruitAthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await recruitViewer();
  if (viewer?.recruiter?.status !== "approved") redirect("/recruit");

  const admin = createAdminClient();
  const [a] = await listedAthletes(admin, id);
  if (!a) notFound();

  const { data: sentRows } = await admin
    .from("recruit_contacts")
    .select("id, message, created_at")
    .eq("recruiter_id", viewer.recruiter.user_id)
    .eq("profile_id", a.id)
    .order("created_at", { ascending: false });
  const sent = (sentRows as { id: string; message: string; created_at: string }[] | null) ?? [];

  const facts: [string, string | null | undefined][] = [
    ["Role", a.role === "coxswain" ? "Coxswain" : "Rower"],
    ["Club", a.clubName],
    ["Graduation year", a.gradYear ? String(a.gradYear) : null],
    ["High school", a.highSchool],
    ["Side", a.side ? SIDE_LABEL[a.side] ?? a.side : null],
    ["Height", a.height],
    ["Weight", a.weightLbs ? `${a.weightLbs} lbs` : null],
    ["2K erg", a.erg2k],
    ["5K erg", a.erg5k],
    ["GPA", a.gpa],
    ["Intended major", a.intendedMajor],
  ];

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
      <Link href="/recruit" className="text-sm text-gray-500 hover:underline">
        ← All athletes
      </Link>
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 shrink-0 rounded-full overflow-hidden bg-gray-100">
          {a.photoUrl && <StorageImage src={a.photoUrl} alt="" fill sizes="96px" className="object-cover" />}
        </div>
        <h1 className="text-2xl font-bold">{a.name}</h1>
      </div>

      <dl className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {facts
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-gray-500">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>

      {a.about && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 text-sm">
          <h2 className="font-semibold mb-1">About</h2>
          <p className="whitespace-pre-wrap">{a.about}</p>
        </section>
      )}
      {a.videoUrl && (
        <a href={a.videoUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-[#022e5d] underline">
          Watch video →
        </a>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-2">
        <h2 className="font-semibold">Contact</h2>
        <p className="text-sm text-gray-600">
          Your message is emailed to {a.name}&apos;s club coach and parents (and to {a.name}, if 18 or over). Their
          replies come straight to your email.
        </p>
        <ActionForm action={contactAthlete} className="flex flex-col gap-2">
          <input type="hidden" name="athlete_id" value={a.id} />
          <textarea
            name="message"
            required
            maxLength={4000}
            rows={5}
            placeholder="Introduce yourself and your program..."
            className="border rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="self-start bg-[#022e5d] text-white rounded-lg px-4 py-2 text-sm font-medium">
            Send
          </button>
        </ActionForm>
        {sent.length > 0 && (
          <div className="text-sm">
            <p className="font-medium mt-2">You sent</p>
            <ul className="flex flex-col gap-2">
              {sent.map((m) => (
                <li key={m.id} className="border-l-2 border-gray-200 pl-2">
                  <span className="text-xs text-gray-500">{new Date(m.created_at).toLocaleDateString()}</span>
                  <p className="whitespace-pre-wrap">{m.message}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
