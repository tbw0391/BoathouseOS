import { oarLabel, tapeSwatch } from "@/lib/oarSheet";

// A boat's oar set at a glance: one dot per piece of tape, in its color
// ("3 Red" = three red dots).
export function OarDots({ oars }: { oars: { tape_color: string; rings: number; swatch?: string } }) {
  const label = `Oars: ${oarLabel(oars)}`;
  return (
    <span className="flex items-center gap-0.5 shrink-0" title={label} aria-label={label} role="img">
      {Array.from({ length: oars.rings }, (_, i) => (
        <span
          key={i}
          className="inline-block w-3 h-3 rounded-full border border-gray-500"
          style={{ backgroundColor: oars.swatch ?? tapeSwatch(oars.tape_color) }}
        />
      ))}
    </span>
  );
}
