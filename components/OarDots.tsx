import { oarLabel, tapeSwatch } from "@/lib/oarSheet";

// A boat's oar set at a glance: one dot per piece of tape, in its color
// ("3 Red" = three red dots). With showLabel, "Oars: 3 Red" follows the dots.
export function OarDots({
  oars,
  showLabel = false,
  size = "w-3 h-3",
  className = "",
}: {
  oars: { tape_color: string; rings: number; swatch?: string };
  showLabel?: boolean;
  size?: string;
  className?: string;
}) {
  const label = `Oars: ${oarLabel(oars)}`;
  const hex = oars.swatch ?? tapeSwatch(oars.tape_color);
  const dots = (
    <span className="flex items-center gap-0.5 shrink-0" aria-hidden={showLabel || undefined}>
      {Array.from({ length: oars.rings }, (_, i) => (
        <span key={i} className={`inline-block ${size} rounded-full border border-gray-500`} style={{ backgroundColor: hex }} />
      ))}
    </span>
  );
  if (!showLabel) {
    return (
      <span className={`flex items-center shrink-0 ${className}`} title={label} aria-label={label} role="img">
        {dots}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={label}>
      {dots}
      <span>{label}</span>
    </span>
  );
}
