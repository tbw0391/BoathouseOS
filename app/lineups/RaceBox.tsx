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

// A race name like "Event 4 - Women's V8+" leads with the race number; only
// that lead is used on the number/time line, since the type of race (the
// part after the separator) is already tracked separately as categoryLabel.
function raceNumber(label: string): string {
  const match = label.match(/^(.*?)[-:–—]\s*.+$/);
  return (match ? match[1] : label).trim();
}

function formatRaceTime(raceTime: string | null): string | null {
  if (!raceTime) return null;
  return new Date(raceTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

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
  const timeLabel = formatRaceTime(item.raceTime);
  const firstLine = [raceNumber(item.label), timeLabel].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-28 flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-2 py-2 text-sm text-center transition hover:brightness-95 min-w-0 ${STATE_CLASSES[item.state]} ${
        selected ? "ring-2 ring-offset-1 ring-[var(--color-primary)]" : ""
      }`}
    >
      {icon && <span className="absolute top-1 right-1.5 text-lg leading-none">{icon}</span>}
      <span className="font-medium truncate w-full">{firstLine}</span>
      <span className="font-medium line-clamp-2 w-full">{item.categoryLabel || ""}</span>
    </button>
  );
}
