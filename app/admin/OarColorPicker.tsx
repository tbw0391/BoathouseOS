"use client";

import { useState } from "react";
import { TAPE_COLOR_CHOICES, tapeSwatch } from "@/lib/oarSheet";

// Tap colors on or off; only the ones on show on oar sheets. A club color
// saved earlier that isn't a standard choice stays as its own button.
export function OarColorPicker({ initial }: { initial: string[] }) {
  const [on, setOn] = useState<string[]>(initial);
  const choices = [...TAPE_COLOR_CHOICES, ...initial.filter((c) => !TAPE_COLOR_CHOICES.includes(c))];

  function toggle(c: string) {
    setOn((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Tape colors</span>
      <span className="text-xs text-gray-500">Tap the colors your club uses. Only these show on oar sheets.</span>
      <div className="flex flex-wrap gap-2 mt-1">
        {choices.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggle(c)}
            aria-pressed={on.includes(c)}
            className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 ${
              on.includes(c) ? "border-[var(--color-primary)] font-medium" : "border-gray-300 text-gray-500 opacity-60"
            }`}
          >
            <span
              className="inline-block w-4 h-4 rounded-full border border-gray-400"
              style={{ backgroundColor: tapeSwatch(c) }}
              aria-hidden
            />
            {c}
          </button>
        ))}
      </div>
      {choices.filter((c) => on.includes(c)).map((c) => (
        <input key={c} type="hidden" name="colors" value={c} />
      ))}
    </div>
  );
}
