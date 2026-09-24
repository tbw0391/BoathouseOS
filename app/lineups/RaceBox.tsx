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
      className={`flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-sm text-left transition hover:brightness-95 min-w-0 ${STATE_CLASSES[item.state]} ${
        selected ? "ring-2 ring-offset-1 ring-[var(--color-primary)]" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.label}</div>
        <div className="text-xs text-gray-500 truncate">{item.categoryLabel || ""}</div>
      </div>
      {icon && <span className="text-lg leading-none shrink-0">{icon}</span>}
    </button>
  );
}
