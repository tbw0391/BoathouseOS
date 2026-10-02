import Link from "next/link";
import { GuidePhotoFigure } from "@/components/GuidePhotoFigure";
import { GUIDE_PHOTOS, type GuidePhoto } from "@/lib/guidePhotos";

// Built-in Rookie Parent page (every club): sweep vs. sculling and the boat
// classes you'll see at regattas, with a photo of each.

type BoatClass = {
  code: string;
  name: string;
  rowers: number;
  cox: boolean;
  text: string;
  photo?: GuidePhoto;
};

const SWEEP: BoatClass[] = [
  { code: "8+", photo: GUIDE_PHOTOS.eight, name: "Eight", rowers: 8, cox: true, text: "The fastest boat on the water and the classic team boat. About 60 feet long. Always has a cox." },
  { code: "4+", photo: GUIDE_PHOTOS.coxedFour, name: "Coxed four", rowers: 4, cox: true, text: "Four rowers and a cox. Very common for juniors and novices. In many fours, like this one, the cox lies down in the bow." },
  { code: "4-", photo: GUIDE_PHOTOS.coxlessFour, name: "Coxless (\"straight\") four", rowers: 4, cox: false, text: "No cox: one rower steers with a small rudder cable attached to their shoe." },
  { code: "2-", name: "Pair", rowers: 2, cox: false, text: "Two rowers, one oar each, no cox. One of the hardest boats to balance. (Pictured above.)" },
];

const SCULL: BoatClass[] = [
  { code: "1x", photo: GUIDE_PHOTOS.single, name: "Single", rowers: 1, cox: false, text: "One sculler, about 27 feet long. They steer by pulling a little harder on one side, looking over their shoulder." },
  { code: "2x", photo: GUIDE_PHOTOS.double, name: "Double", rowers: 2, cox: false, text: "Two scullers. A popular boat for juniors and masters." },
  { code: "4x", photo: GUIDE_PHOTOS.quad, name: "Quad", rowers: 4, cox: false, text: "Four scullers, usually no cox (one rower steers with a foot rudder). Juniors often race a coxed quad (4x+)." },
  { code: "8x+", name: "Octuple", rowers: 8, cox: true, text: "Eight scullers and a cox. Rare; mostly used for learn-to-row and young beginners." },
];

function BoatList({ boats }: { boats: BoatClass[] }) {
  return (
    <ul className="mt-3 grid gap-4 sm:grid-cols-2">
      {boats.map((b) => (
        <li key={b.code} className="rounded-lg border p-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-bold text-lg">{b.code}</span>
            <span className="font-semibold">{b.name}</span>
            <span className="text-xs text-gray-500">
              {b.rowers} {b.rowers === 1 ? "rower" : "rowers"}
              {b.cox ? " + cox" : ""}
            </span>
          </div>
          <p className="text-sm mt-1">{b.text}</p>
          {b.photo && <GuidePhotoFigure photo={b.photo} className="mt-2" />}
        </li>
      ))}
    </ul>
  );
}

export default function BoatTypesPage() {
  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-3xl">
      <Link href="/rookie-parent" className="text-sm text-gray-500 hover:underline">
        ← Rookie Parent
      </Link>
      <h1 className="text-2xl font-bold mt-2">Sweep vs. Sculling Boats</h1>
      <p className="text-sm text-gray-600 mt-1">
        Every boat is either sweep (one oar per rower) or sculling (two oars per rower).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border-2 border-[var(--color-primary)] p-4">
          <h2 className="font-semibold">Sweep rowing</h2>
          <p className="text-sm mt-1">
            Each rower holds <strong>one oar</strong> (about 12½ feet long) with both hands, on
            either the port or starboard side. Rowers are often called &quot;ports&quot; or
            &quot;starboards&quot; for the side they usually row. Most high school and college
            team racing is sweep.
          </p>
          <GuidePhotoFigure photo={GUIDE_PHOTOS.pair} className="mt-3" caption="A pair: one oar each, on opposite sides." />
        </div>
        <div className="rounded-lg border-2 border-[var(--color-primary)] p-4">
          <h2 className="font-semibold">Sculling</h2>
          <p className="text-sm mt-1">
            Each rower holds <strong>two oars</strong> (&quot;sculls&quot;, about 9½ feet long), one
            in each hand. Sculling boats are a little faster for their size, and singles and
            doubles are how many rowers learn balance and train on their own.
          </p>
          <GuidePhotoFigure photo={GUIDE_PHOTOS.scullers} className="mt-3" caption="Scullers: an oar in each hand." />
        </div>
      </div>

      <h2 className="text-lg font-semibold mt-8">Reading boat names</h2>
      <ul className="mt-2 text-sm flex flex-col gap-1">
        <li>
          The number is how many rowers (the cox doesn&apos;t count): <strong>8+</strong> is eight rowers.
        </li>
        <li>
          <strong>+</strong> means there&apos;s a cox; <strong>-</strong> means there isn&apos;t.
        </li>
        <li>
          <strong>x</strong> means sculling: <strong>4x</strong> is a quad, <strong>4-</strong> is a sweep
          four with no cox.
        </li>
        <li>
          On results you&apos;ll also see things like <strong>JV8+</strong> (junior varsity eight),{" "}
          <strong>W2x</strong> (women&apos;s double) or <strong>LTWT</strong> (lightweight).
        </li>
      </ul>

      <h2 className="text-lg font-semibold mt-8">Sweep boats</h2>
      <BoatList boats={SWEEP} />

      <h2 className="text-lg font-semibold mt-8">Sculling boats</h2>
      <BoatList boats={SCULL} />

      <h2 className="text-lg font-semibold mt-8">Which is fastest?</h2>
      <p className="text-sm mt-1">
        Roughly, from fastest: eight, quad, coxless four, double, coxed four, pair, single. More
        rowers means more power for not much more boat. At high school regattas you&apos;ll mostly see
        eights, coxed fours, quads, doubles and singles.
      </p>

      <p className="mt-8 text-sm">
        See also:{" "}
        <Link href="/rookie-parent/shell" className="underline">
          Parts of a Racing Shell
        </Link>
      </p>
    </div>
  );
}
