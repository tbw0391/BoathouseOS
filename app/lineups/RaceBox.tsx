"use client";

import type { RaceBoxItem, RaceBoxState } from "./raceBoxTypes";

const STATE_CLASSES: Record<RaceBoxState, string> = {
  pending: "border-[var(--color-primary)] bg-white",
  assigned: "border-green-600 bg-green-50",
  gold: "border-yellow-500 bg-yellow-100",
  silver: "border-gray-400 bg-gray-200",
  bronze: "border-orange-400 bg-orange-100",
};

const STATE_ICON: Partial<Record<RaceBoxState, string>> = {
  gold: "🥇",
  silver: "🥈",
  bronze: "🥉",
};

export function RaceBox({
  item,
  selected,
  onClick,
}: {
  item: RaceBoxItem;
  selected: boolean;
  onClick: () => void;
}) {
  const icon = STATE_ICON[item.state];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-28 flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-2 py-2 text-sm text-center transition hover:brightness-95 min-w-0 ${STATE_CLASSES[item.state]} ${
        selected ? "ring-2 ring-offset-1 ring-[var(--color-primary)]" : ""
      }`}
    >
      <span className="text-lg leading-none h-5">{icon ?? ""}</span>
      <span className="font-medium line-clamp-2 w-full">{item.label}</span>
      <span className="text-xs text-gray-500 truncate w-full h-4">{item.categoryLabel || ""}</span>
    </button>
  );
}
