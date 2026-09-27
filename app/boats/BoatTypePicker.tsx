"use client";

import { useState } from "react";
import { BOAT_CLASSES } from "@/lib/boatClasses";
import { CATEGORY_BOAT_CLASS, LINEUP_CATEGORIES } from "@/lib/lineupCategories";
import { HULL_COLORS, HULL_COLOR_OPTIONS, RIGS } from "@/lib/boatOptions";

// Tap-through replacement for the long "Boat type" dropdown when adding a
// boat: size, then squad, then which boat in the depth chart. Posts the same
// boat_type / hull_color / rig fields createBoat already reads.

const SIZES = ["8+", "4+", "4x", "4-", "2x", "2-", "1x"];
const SCULLING = new Set(["1x", "2x", "4x"]);
const SWEEP_RIGS = ["port", "starboard", "port_bucket", "starboard_bucket"];

const SQUADS = [
  { slug: "mens", label: "Men's" },
  { slug: "womens", label: "Women's" },
  { slug: "masters", label: "Masters" },
];

const SIZE_SLUG: Record<string, string> = { "8+": "8plus", "4+": "4plus", "4x": "4x", "4-": "4minus" };

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-lg border-2 px-3 py-2 text-sm font-medium ${
        selected
          ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
          : "border-gray-300 hover:border-[var(--color-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function BoatTypePicker({ showColorAndRig = true }: { showColorAndRig?: boolean }) {
  const [size, setSize] = useState<string | null>(null);
  const [squad, setSquad] = useState<string | null>(null);
  const [depth, setDepth] = useState<number | null>(null);
  const [hullColor, setHullColor] = useState<string | null>(null);
  const [rig, setRig] = useState<string | null>(null);

  const categoryKey = size && squad && squad !== "none" && depth ? `${squad}_${depth}_${SIZE_SLUG[size]}` : null;
  const hasDepthChart = size ? Object.values(CATEGORY_BOAT_CLASS).includes(size) : false;
  const squads = SQUADS.filter((s) => {
    if (!size) return false;
    const key = `${s.slug}_1_${SIZE_SLUG[size]}`;
    return key in CATEGORY_BOAT_CLASS;
  });
  const depths = squad && squad !== "none" && size
    ? [1, 2, 3, 4].filter((d) => `${squad}_${d}_${SIZE_SLUG[size]}` in CATEGORY_BOAT_CLASS)
    : [];

  const boatType = categoryKey ?? (size && (!hasDepthChart || squad === "none") ? size : "");
  const summary = categoryKey ? LINEUP_CATEGORIES[categoryKey] : boatType ? BOAT_CLASSES[boatType].label : null;
  const effectiveRig = size && SCULLING.has(size) ? "scull" : rig;

  function pickSize(next: string) {
    setSize(next);
    setSquad(null);
    setDepth(null);
    setRig(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="boat_type" value={boatType} />
      <input type="hidden" name="hull_color" value={hullColor ?? ""} />
      <input type="hidden" name="rig" value={effectiveRig ?? ""} />

      <Step label="Size">
        {SIZES.map((s) => (
          <Choice key={s} selected={size === s} onClick={() => pickSize(s)}>
            {s}
          </Choice>
        ))}
      </Step>

      {hasDepthChart && (
        <Step label="Squad">
          {squads.map((s) => (
            <Choice
              key={s.slug}
              selected={squad === s.slug}
              onClick={() => {
                setSquad(s.slug);
                setDepth(null);
              }}
            >
              {s.label}
            </Choice>
          ))}
          <Choice
            selected={squad === "none"}
            onClick={() => {
              setSquad("none");
              setDepth(null);
            }}
          >
            No squad
          </Choice>
        </Step>
      )}

      {depths.length > 0 && (
        <Step label="Which boat">
          {depths.map((d) => (
            <Choice key={d} selected={depth === d} onClick={() => setDepth(d)}>
              {["1st", "2nd", "3rd", "4th"][d - 1]}
            </Choice>
          ))}
        </Step>
      )}

      {showColorAndRig && (
        <>
          <Step label="Hull color (optional)">
            {HULL_COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                title={HULL_COLORS[c].label}
                aria-label={HULL_COLORS[c].label}
                aria-pressed={hullColor === c}
                onClick={() => setHullColor(hullColor === c ? null : c)}
                className={`w-9 h-9 rounded-full border-2 ${
                  hullColor === c ? "ring-2 ring-offset-2 ring-[var(--color-primary)] border-gray-700" : "border-gray-300"
                }`}
                style={{ backgroundColor: HULL_COLORS[c].swatch }}
              />
            ))}
          </Step>

          {size && !SCULLING.has(size) && (
            <Step label="Rig (optional)">
              {SWEEP_RIGS.map((r) => (
                <Choice key={r} selected={rig === r} onClick={() => setRig(rig === r ? null : r)}>
                  {RIGS[r]}
                </Choice>
              ))}
            </Step>
          )}
        </>
      )}

      <p className="text-sm text-gray-600">
        {summary ? (
          <>
            Adding: <span className="font-medium text-gray-900">{summary}</span>
            {showColorAndRig && hullColor && `, ${HULL_COLORS[hullColor].label.toLowerCase()} hull`}
            {showColorAndRig && effectiveRig && `, ${RIGS[effectiveRig].toLowerCase()} rig`}
          </>
        ) : (
          "Pick a size to get started."
        )}
      </p>
    </div>
  );
}
