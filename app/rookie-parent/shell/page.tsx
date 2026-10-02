import Link from "next/link";

// Built-in Rookie Parent page (every club): a labeled top view of an eight
// and what each part is. Not editable; admins add their own sections on
// /rookie-parent.

const SEATS = [8, 7, 6, 5, 4, 3, 2, 1];
const seatX = (seat: number) => 150 + (8 - seat) * 70;
// American rig: even seats (stroke side) on port, odd seats on starboard.
const isPort = (seat: number) => seat % 2 === 0;

function Callout({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={11} fill="var(--color-primary)" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
        {n}
      </text>
    </g>
  );
}

function ShellDiagram() {
  return (
    <svg
      viewBox="0 0 800 275"
      className="w-full min-w-[640px] h-auto"
      role="img"
      aria-label="Top view of an eight: the coxswain sits at the stern facing the rowers, seats are numbered 8 (stroke) to 1 (bow), and each rower's oar sticks out on port or starboard from a rigger."
    >
      <text x={400} y={12} textAnchor="middle" fontSize={11} fill="#6b7280">
        PORT side (rowers&apos; right hand)
      </text>
      <text x={400} y={270} textAnchor="middle" fontSize={11} fill="#6b7280">
        STARBOARD side (rowers&apos; left hand)
      </text>

      {/* Oars and riggers under the hull */}
      {SEATS.map((seat) => {
        const x = seatX(seat);
        const s = isPort(seat) ? -1 : 1; // -1 draws up (port), 1 down (starboard)
        const edge = 130 + s * 18;
        const lock = 130 + s * 68;
        return (
          <g key={seat}>
            <path
              d={`M ${x - 4} ${edge} L ${x - 10} ${lock} L ${x + 6} ${edge}`}
              fill="none"
              stroke="#9ca3af"
              strokeWidth={2}
            />
            <line x1={x + 6} y1={130 - s * 4} x2={x - 20} y2={130 + s * 100} stroke="#6b7280" strokeWidth={2.5} />
            <line
              x1={x - 14}
              y1={130 + s * 79}
              x2={x - 20}
              y2={130 + s * 100}
              stroke="var(--color-primary)"
              strokeWidth={8}
              strokeLinecap="round"
            />
            <rect x={x - 14} y={lock - 3} width={8} height={6} rx={1} fill="#374151" />
          </g>
        );
      })}

      {/* Hull */}
      <path
        d="M 40 130 Q 120 112 400 112 Q 680 112 760 130 Q 680 148 400 148 Q 120 148 40 130 Z"
        fill="#f3f4f6"
        stroke="#374151"
        strokeWidth={2}
      />
      <circle cx={762} cy={130} r={4} fill="#374151" />
      <rect x={44} y={127} width={9} height={6} rx={1} fill="#374151" />

      {/* Coxswain */}
      <rect x={88} y={124} width={14} height={12} rx={3} fill="#9ca3af" />
      <text x={95} y={160} textAnchor="middle" fontSize={10} fill="#374151">
        cox
      </text>

      {/* Seats, foot stretchers and seat numbers */}
      {SEATS.map((seat) => {
        const x = seatX(seat);
        return (
          <g key={seat}>
            <rect x={x - 8} y={125} width={16} height={10} rx={2} fill="#9ca3af" />
            <line x1={x - 26} y1={122} x2={x - 26} y2={138} stroke="#374151" strokeWidth={3} />
            <text x={x + 16} y={134} fontSize={11} fontWeight={700} fill="#374151">
              {seat}
            </text>
          </g>
        );
      })}

      <text x={690} y={250} fontSize={11} fill="#6b7280">
        moves this way →
      </text>

      <Callout n={1} x={772} y={104} />
      <Callout n={2} x={640} y={96} />
      <Callout n={3} x={150} y={166} />
      <Callout n={4} x={95} y={96} />
      <Callout n={5} x={30} y={104} />
      <Callout n={6} x={48} y={160} />
      <Callout n={7} x={452} y={88} />
      <Callout n={8} x={302} y={56} />
      <Callout n={9} x={244} y={30} />
      <Callout n={10} x={506} y={96} />
      <Callout n={11} x={334} y={96} />
    </svg>
  );
}

const PARTS: { name: string; text: string }[] = [
  {
    name: "Bow and bow ball",
    text: "The front of the boat, which crosses the finish line first. The rubber ball on the tip is a safety bumper, and it's where the bow number card clips on at races.",
  },
  {
    name: "Bow seat (seat 1)",
    text: "The rower closest to the bow. Seats are numbered from the bow back, so in an eight the bow seat is 1.",
  },
  {
    name: "Stroke seat (seat 8)",
    text: "The rower closest to the stern, who sets the rhythm (the stroke rate) everyone else follows.",
  },
  {
    name: "Coxswain (\"cox\")",
    text: "Steers, calls the race and runs the boat. In an eight the cox sits in the stern facing the rowers; in some fours the cox lies down in the bow. Rowers sit backwards, facing the stern, so the cox is their eyes.",
  },
  {
    name: "Stern",
    text: "The back of the boat. In a coxed boat the cox's seat and steering cables are here.",
  },
  {
    name: "Rudder and fin (skeg)",
    text: "Underneath the stern: a small rudder the cox steers with, and a fin that keeps the boat running straight. They're fragile, which is why boats are always carried and set down carefully.",
  },
  {
    name: "Rigger (outrigger)",
    text: "The metal or carbon arm bolted to the side of the boat at each seat that holds the oar out away from the hull for leverage.",
  },
  {
    name: "Oarlock (gate)",
    text: "The swiveling holder at the end of the rigger. The oar sits in it, and the gate closes over the top to keep it in.",
  },
  {
    name: "Oar and blade",
    text: "Each sweep rower pulls one oar about 12 feet long; scullers pull two shorter ones. The colored end that goes in the water is the blade, and its colors are the club's racing colors.",
  },
  {
    name: "Sliding seat",
    text: "Each seat rolls on wheels along a track (the slide), so rowers drive with their legs. Most of a stroke's power comes from the legs, not the arms.",
  },
  {
    name: "Foot stretcher",
    text: "The plate with shoes bolted in where the rower's feet go. Rowers set it to fit their height before each row.",
  },
];

const TERMS: { term: string; text: string }[] = [
  { term: "Hull / shell", text: "The boat itself: long, narrow and usually carbon fiber. An eight is about 60 feet long and only about 2 feet wide." },
  { term: "Port and starboard", text: "Port is the rowers' right-hand side and starboard their left (they face the stern). A rower whose oar is on port is a \"port\"; on starboard, a \"starboard\"." },
  { term: "Bow pair / stern pair", text: "Seats 1 and 2, and the two seats nearest the stern. You'll hear coaches ask for just a pair or four to row while the others sit out (\"bow four\", \"stern four\")." },
  { term: "Cox box", text: "The small speaker and stroke-rate computer the cox wears or mounts in the boat so the whole crew can hear them." },
  { term: "Launch", text: "The coach's motorboat that follows crews on the water." },
  { term: "Slings and racks", text: "Boats are stored upside down on racks in the boathouse and set on folding slings when they're rigged or washed." },
];

export default function ShellPartsPage() {
  return (
    <div className="min-h-screen p-8 max-w-3xl">
      <Link href="/rookie-parent" className="text-sm text-gray-500 hover:underline">
        ← Rookie Parent
      </Link>
      <h1 className="text-2xl font-bold mt-2">Parts of a Racing Shell</h1>
      <p className="text-sm text-gray-600 mt-1">
        An eight from above. Rowers sit backwards, facing the stern, and the cox faces them.
      </p>

      <div className="mt-6 rounded-lg border p-3 overflow-x-auto">
        <ShellDiagram />
      </div>
      <p className="text-xs text-gray-500 mt-1 sm:hidden">Swipe the picture to see the whole boat.</p>

      <ol className="mt-6 flex flex-col gap-3">
        {PARTS.map((p, i) => (
          <li key={p.name} className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <p className="text-sm">
              <span className="font-semibold">{p.name}.</span> {p.text}
            </p>
          </li>
        ))}
      </ol>

      <h2 className="text-lg font-semibold mt-8">Words you&apos;ll hear</h2>
      <dl className="mt-2 flex flex-col gap-2">
        {TERMS.map((t) => (
          <div key={t.term} className="text-sm">
            <dt className="font-semibold inline">{t.term}: </dt>
            <dd className="inline">{t.text}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 text-sm">
        Next:{" "}
        <Link href="/rookie-parent/boat-types" className="underline">
          Sweep vs. Sculling Boats
        </Link>
      </p>
    </div>
  );
}
