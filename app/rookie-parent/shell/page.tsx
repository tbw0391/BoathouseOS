import Link from "next/link";
import { GuidePhotoFigure, PhotoMarker } from "@/components/GuidePhotoFigure";
import { GUIDE_PHOTOS } from "@/lib/guidePhotos";

// Built-in Rookie Parent page (every club): the parts of a shell, on a real
// photo of an eight with numbered markers, plus close-ups and the seat
// numbers. Not editable; admins add their own sections on /rookie-parent.

// Markers on the eight photo, in % of its width and height.
const PARTS: { name: string; text: string; x: number; y: number }[] = [
  {
    name: "Coxswain (\"cox\")",
    text: "Steers, calls the race and runs the boat. In an eight the cox sits in the stern facing the rowers. Rowers sit backwards, so the cox is their eyes.",
    x: 30.4,
    y: 58.8,
  },
  {
    name: "Stern",
    text: "The back of the boat, where the cox sits. The rudder and fin are underneath it.",
    x: 25,
    y: 81,
  },
  {
    name: "Stroke seat (seat 8)",
    text: "The rower closest to the stern, who sets the rhythm (the stroke rate) everyone else follows.",
    x: 36.7,
    y: 41.3,
  },
  {
    name: "Bow seat (seat 1)",
    text: "The rower closest to the bow. Seats are numbered from the bow back.",
    x: 70,
    y: 18.8,
  },
  {
    name: "Bow and bow ball",
    text: "The front of the boat, which crosses the finish line first. The rubber ball on the tip is a safety bumper, and the bow number card clips on there at races.",
    x: 75.4,
    y: 31.9,
  },
  {
    name: "Rigger (outrigger)",
    text: "The metal or carbon arm bolted to the side of the boat at each seat. It holds the oar out away from the hull for leverage.",
    x: 52.5,
    y: 66,
  },
  {
    name: "Oarlock (gate)",
    text: "The swiveling holder at the end of the rigger. The oar sits in it, and the gate closes over the top to keep it in.",
    x: 60.4,
    y: 63.1,
  },
  {
    name: "Oar (shaft)",
    text: "In an eight each rower pulls one oar, about 12½ feet long. The collar on the oar rests against the oarlock.",
    x: 79.2,
    y: 68.5,
  },
  {
    name: "Blade",
    text: "The end that goes in the water. Blades are painted in the club's racing colors, which is how you spot your crew from the shore.",
    x: 94.2,
    y: 73.1,
  },
];

const TERMS: { term: string; text: string }[] = [
  { term: "Rudder and fin (skeg)", text: "Underneath the stern: a small rudder the cox steers with, and a fin that keeps the boat running straight. They're fragile, which is why boats are always carried and set down carefully." },
  { term: "Hull / shell", text: "The boat itself: long, narrow and usually carbon fiber. An eight is about 60 feet long and only about 2 feet wide." },
  { term: "Port and starboard", text: "Port is the rowers' right-hand side and starboard their left (they face the stern). In the photo above, the oars on the left of the picture are port. Rowers are called \"ports\" or \"starboards\" for the side their oar is on." },
  { term: "Bow pair / stern pair", text: "Seats 1 and 2, and the two seats nearest the stern. Coaches often have just a pair or four row while the others sit out (\"bow four\", \"stern four\")." },
  { term: "Cox box", text: "The small speaker and stroke-rate computer the cox uses so the whole crew can hear them." },
  { term: "Launch", text: "The coach's motorboat that follows crews on the water." },
  { term: "Slings and racks", text: "Boats are stored upside down on racks in the boathouse and set on folding slings when they're rigged or washed." },
];

export default function ShellPartsPage() {
  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-3xl">
      <Link href="/rookie-parent" className="text-sm text-gray-500 hover:underline">
        ← Rookie Parent
      </Link>
      <h1 className="text-2xl font-bold mt-2">Parts of a Racing Shell</h1>
      <p className="text-sm text-gray-600 mt-1">
        An eight, seen from behind the cox. Rowers sit backwards, facing the stern.
      </p>

      <GuidePhotoFigure photo={GUIDE_PHOTOS.eightStern} className="mt-5">
        {PARTS.map((p, i) => (
          <PhotoMarker key={p.name} n={i + 1} x={p.x} y={p.y} />
        ))}
      </GuidePhotoFigure>

      <ol className="mt-5 flex flex-col gap-3">
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

      <h2 className="text-lg font-semibold mt-8">Up close</h2>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <GuidePhotoFigure
          photo={GUIDE_PHOTOS.slidingSeat}
          caption={
            <>
              <span className="font-semibold">Sliding seat.</span> Each seat rolls on wheels along a track (the
              slide), so rowers drive with their legs. Most of a stroke&apos;s power comes from the legs.
            </>
          }
        />
        <GuidePhotoFigure
          photo={GUIDE_PHOTOS.footStretcher}
          caption={
            <>
              <span className="font-semibold">Foot stretcher.</span> Shoes bolted to a plate where the rower&apos;s
              feet go, set to fit their height. In boats with no cox, one shoe also steers the rudder with a cable.
            </>
          }
        />
      </div>

      <h2 className="text-lg font-semibold mt-8">Seat numbers</h2>
      <p className="text-sm mt-1">
        Seats are numbered from the bow: the bow seat is 1, and in an eight the stroke seat is 8, right in front of
        the cox. Lineups list rowers by seat.
      </p>
      <GuidePhotoFigure photo={GUIDE_PHOTOS.seatPositions} className="mt-3" />

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
