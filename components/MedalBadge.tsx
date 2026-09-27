import type { Medal } from "@/lib/medals";
import { ordinalPlace } from "@/lib/raceResults";

const METALS = {
  1: { name: "Gold", light: "#fde68a", mid: "#f59e0b", dark: "#92400e" },
  2: { name: "Silver", light: "#f1f5f9", mid: "#94a3b8", dark: "#475569" },
  3: { name: "Bronze", light: "#fcd3a8", mid: "#c2733a", dark: "#6b3a17" },
} as const;

// A medal on a ribbon in the club's colors, with the regatta's logo in the
// middle when one has been uploaded (Regattas page → Add medal logo), or the
// place otherwise.
export function MedalBadge({ medal }: { medal: Medal }) {
  const metal = METALS[medal.place];
  const id = `medal-${medal.lineupId}`;

  return (
    <figure className="flex flex-col items-center text-center w-32">
      <svg viewBox="0 0 120 150" className="w-28 h-auto" role="img" aria-label={`${metal.name}, ${medal.eventTitle} ${medal.year}`}>
        <defs>
          <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={metal.light} />
            <stop offset="50%" stopColor={metal.mid} />
            <stop offset="100%" stopColor={metal.dark} />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <circle cx="60" cy="100" r="31" />
          </clipPath>
        </defs>
        <polygon points="30,0 52,0 66,62 50,66" style={{ fill: "var(--color-primary)" }} />
        <polygon points="90,0 68,0 54,62 70,66" style={{ fill: "var(--color-secondary)" }} />
        <circle cx="60" cy="100" r="44" fill={`url(#${id}-ring)`} stroke={metal.dark} strokeWidth="1.5" />
        <circle cx="60" cy="100" r="34" fill="white" stroke={metal.dark} strokeWidth="1" />
        {medal.artworkUrl ? (
          <image
            href={medal.artworkUrl}
            x="29"
            y="69"
            width="62"
            height="62"
            preserveAspectRatio="xMidYMid meet"
            clipPath={`url(#${id}-clip)`}
          />
        ) : (
          <>
            <text x="60" y="104" textAnchor="middle" fontSize="22" fontWeight="700" fill={metal.dark}>
              {ordinalPlace(medal.place)}
            </text>
            <text x="60" y="119" textAnchor="middle" fontSize="9" fontWeight="600" letterSpacing="1" fill={metal.dark}>
              {metal.name.toUpperCase()}
            </text>
          </>
        )}
      </svg>
      <figcaption className="mt-1 text-xs leading-snug">
        <span className="block font-medium">
          {medal.eventTitle} {medal.year}
        </span>
        {medal.raceLabel && <span className="block text-gray-500">{medal.raceLabel}</span>}
      </figcaption>
    </figure>
  );
}
