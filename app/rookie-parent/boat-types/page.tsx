import Link from "next/link";

// Built-in Rookie Parent page (every club): sweep vs. sculling and the boat
// classes you'll see at regattas, each with a small top-view drawing.

type BoatClass = {
  code: string;
  name: string;
  rowers: number;
  cox: boolean;
  text: string;
};

const SWEEP: BoatClass[] = [
  { code: "8+", name: "Eight", rowers: 8, cox: true, text: "The fastest boat on the water and the classic team boat. About 60 feet long. Always has a cox." },
  { code: "4+", name: "Coxed four", rowers: 4, cox: true, text: "Four rowers and a cox. Very common for juniors and novices." },
  { code: "4-", name: "Coxless (\"straight\") four", rowers: 4, cox: false, text: "No cox: one rower steers with a small rudder cable attached to their shoe." },
  { code: "2-", name: "Pair", rowers: 2, cox: false, text: "Two rowers, one oar each, no cox. One of the hardest boats to balance." },
];

const SCULL: BoatClass[] = [
  { code: "1x", name: "Single", rowers: 1, cox: false, text: "One sculler, about 27 feet long. They steer by pulling a little harder on one side, looking over their shoulder." },
  { code: "2x", name: "Double", rowers: 2, cox: false, text: "Two scullers. A popular boat for juniors and masters." },
  { code: "4x", name: "Quad", rowers: 4, cox: false, text: "Four scullers, usually no cox (one rower steers with a foot rudder). Juniors often race a coxed quad (4x+)." },
  { code: "8x+", name: "Octuple", rowers: 8, cox: true, text: "Eight scullers and a cox. Rare; mostly used for learn-to-row and young beginners." },
];

// Top view, bow to the right, stern (and cox) on the left.
function MiniBoat({ rowers, sculling, cox }: { rowers: number; sculling: boolean; cox: boolean }) {
  const gap = 34;
  const start = cox ? 52 : 34;
  const length = start + rowers * gap + 20;
  const w = length + 20;
  return (
    <svg viewBox={`0 0 ${w} 76`} className="h-12 w-auto max-w-full" aria-hidden>
      {Array.from({ length: rowers }, (_, i) => {
        const x = start + i * gap + 10;
        // Sweep: alternate sides (stroke on port, the top). Sculling: both.
        const sides = sculling ? [-1, 1] : [i % 2 === 0 ? -1 : 1];
        return sides.map((s) => (
          <g key={`${i}${s}`}>
            <line x1={x + 3} y1={38} x2={x - 8} y2={38 + s * 32} stroke="#6b7280" strokeWidth={2} />
            <line
              x1={x - 5}
              y1={38 + s * 24}
              x2={x - 8}
              y2={38 + s * 32}
              stroke="var(--color-primary)"
              strokeWidth={6}
              strokeLinecap="round"
            />
          </g>
        ));
      })}
      <path
        d={`M 10 38 Q 30 30 ${w / 2} 30 Q ${w - 30} 30 ${w - 10} 38 Q ${w - 30} 46 ${w / 2} 46 Q 30 46 10 38 Z`}
        fill="#f3f4f6"
        stroke="#374151"
        strokeWidth={1.5}
      />
      {cox && <rect x={24} y={34} width={10} height={8} rx={2} fill="#374151" />}
      {Array.from({ length: rowers }, (_, i) => (
        <rect key={i} x={start + i * gap + 4} y={34} width={10} height={8} rx={2} fill="#9ca3af" />
      ))}
    </svg>
  );
}

function BoatList({ boats, sculling }: { boats: BoatClass[]; sculling: boolean }) {
  return (
    <ul className="mt-3 flex flex-col gap-4">
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
          <MiniBoat rowers={b.rowers} sculling={sculling} cox={b.cox} />
          <p className="text-sm mt-1">{b.text}</p>
        </li>
      ))}
    </ul>
  );
}

export default function BoatTypesPage() {
  return (
    <div className="min-h-screen p-8 max-w-3xl">
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
        </div>
        <div className="rounded-lg border-2 border-[var(--color-primary)] p-4">
          <h2 className="font-semibold">Sculling</h2>
          <p className="text-sm mt-1">
            Each rower holds <strong>two oars</strong> (&quot;sculls&quot;, about 9½ feet long), one
            in each hand. Sculling boats are a little faster for their size, and singles and
            doubles are how many rowers learn balance and train on their own.
          </p>
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
      <BoatList boats={SWEEP} sculling={false} />

      <h2 className="text-lg font-semibold mt-8">Sculling boats</h2>
      <BoatList boats={SCULL} sculling />

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
