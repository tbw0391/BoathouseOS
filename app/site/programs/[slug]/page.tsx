import { notFound } from "next/navigation";
import { publicPrograms } from "@/lib/website";
import { formatPrice, formatProgramDates, formatWhenEastern, programState, spotsLeft } from "@/lib/programs";
import { SiteShell, loadSite } from "../../SiteShell";
import { SiteText } from "../../SiteText";
import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function SiteProgram({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { club, preview, member } = await loadSite("programs");
  const program = (await publicPrograms(club.id)).find((p) => p.slug === slug);
  if (!program) notFound();
  const state = programState(program);
  const left = spotsLeft(program.capacity, program.registered);
  const facts: [string, string | null][] = [
    ["When", formatProgramDates(program.starts_on, program.ends_on)],
    ["Schedule", program.schedule],
    ["Who", program.ages],
    ["Cost", formatPrice(program.price_cents)],
    ["Spots", left === null ? null : left === 0 ? "Full (waitlist open)" : `${left} left`],
  ];

  return (
    <SiteShell club={club} preview={preview} member={member}>
      <h1 className="text-3xl font-bold mb-4">{program.title}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mb-6">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-gray-600">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      {program.description && (
        <div className="text-gray-700 mb-8 max-w-2xl">
          <SiteText text={program.description} />
        </div>
      )}

      <section className="max-w-lg">
        <h2 className="text-2xl font-bold mb-3">{left === 0 ? "Join the waitlist" : "Register"}</h2>
        {state === "open" ? (
          <RegisterForm
            programId={program.id}
            waiver={program.waiver}
            questions={program.questions}
            full={left === 0}
            price={formatPrice(program.price_cents)}
          />
        ) : state === "not_yet" ? (
          <p className="text-gray-600">Registration opens {program.opens_at ? formatWhenEastern(program.opens_at) : "soon"}.</p>
        ) : (
          <p className="text-gray-600">Registration has closed. Questions? Use the Contact page.</p>
        )}
      </section>
    </SiteShell>
  );
}
