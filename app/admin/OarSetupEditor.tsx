"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  OAR_GROUPS,
  OAR_GROUP_LABELS,
  TAPE_COLOR_CHOICES,
  tapeSwatch,
  type OarSet,
  type OarSettings,
  type TapeColor,
} from "@/lib/oarSheet";

// Admin → Oar tape: the club's tape colors (standard or its own), the most
// pieces of tape, and the master list of oar sets with the squads that use
// each. Everything goes up as one JSON field ("oar_settings") on Save.

function Swatch({ hex, size = "w-4 h-4" }: { hex: string; size?: string }) {
  return (
    <span
      className={`inline-block ${size} rounded-full border border-gray-400 shrink-0`}
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
}

function newId() {
  return `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function OarSetupEditor({ initial }: { initial: OarSettings }) {
  const [colors, setColors] = useState<TapeColor[]>(initial.colors);
  const [maxRings, setMaxRings] = useState<number>(initial.maxRings);
  const [sets, setSets] = useState<OarSet[]>(initial.sets);

  const [customName, setCustomName] = useState("");
  const [customHex, setCustomHex] = useState("#0ea5e9");
  const [colorError, setColorError] = useState<string | null>(null);

  const [newColor, setNewColor] = useState<string>(
    initial.colors[0]?.name ?? "",
  );
  const [newRings, setNewRings] = useState<number>(1);
  const [newGroups, setNewGroups] = useState<string[]>([]);
  const [setsError, setSetsError] = useState<string | null>(null);

  const has = (name: string) =>
    colors.some((c) => c.name.toLowerCase() === name.toLowerCase());
  const quickAdd = TAPE_COLOR_CHOICES.filter((c) => !has(c));

  function addColor(name: string, hex: string) {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return setColorError("Give the color a name.");
    if (clean.length > 30)
      return setColorError("Keep the name under 30 letters.");
    if (has(clean)) return setColorError(`${clean} is already on the list.`);
    const named = clean[0].toUpperCase() + clean.slice(1);
    setColors((cur) => [...cur, { name: named, hex }]);
    if (!newColor) setNewColor(named);
    setColorError(null);
  }

  function removeColor(name: string) {
    const used = sets.filter((s) => s.color === name).length;
    if (
      used > 0 &&
      !confirm(
        `Remove ${name}? Its ${used} oar set${used === 1 ? "" : "s"} will be removed too.`,
      )
    )
      return;
    setColors((cur) => cur.filter((c) => c.name !== name));
    setSets((cur) => cur.filter((s) => s.color !== name));
    if (newColor === name)
      setNewColor(colors.find((c) => c.name !== name)?.name ?? "");
  }

  function setHex(name: string, hex: string) {
    setColors((cur) => cur.map((c) => (c.name === name ? { ...c, hex } : c)));
  }

  function addSet() {
    if (!newColor) return setSetsError("Add a tape color first.");
    if (!Number.isInteger(newRings) || newRings < 1 || newRings > 20)
      return setSetsError("Pieces of tape must be 1 to 20.");
    if (sets.some((s) => s.color === newColor && s.rings === newRings)) {
      return setSetsError(`${newRings} ${newColor} is already on the list.`);
    }
    setSets((cur) =>
      [
        ...cur,
        {
          id: newId(),
          color: newColor,
          rings: newRings,
          groups: newGroups,
          note: "",
        },
      ].sort((a, b) => a.color.localeCompare(b.color) || a.rings - b.rings),
    );
    if (newRings > maxRings) setMaxRings(newRings);
    setNewRings((n) => Math.min(20, n + 1));
    setSetsError(null);
  }

  function updateSet(id: string, patch: Partial<OarSet>) {
    setSets((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function toggle(list: string[], g: string) {
    return list.includes(g) ? list.filter((x) => x !== g) : [...list, g];
  }

  const payload = JSON.stringify({ colors, maxRings, sets });

  return (
    <div className="flex flex-col gap-6 text-sm">
      <input type="hidden" name="oar_settings" value={payload} />

      {/* Colors */}
      <section className="flex flex-col gap-2">
        <span className="font-medium">Tape colors</span>
        <span className="text-xs text-gray-500">
          The colors your club tapes its oars with. Tap a swatch to change its
          shade.
        </span>
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => (
            <span
              key={c.name}
              className="flex items-center gap-1.5 rounded-lg border-2 border-gray-300 pl-2 pr-1 py-1"
            >
              <label
                className="relative cursor-pointer"
                title={`Change ${c.name}'s shade`}
              >
                <Swatch hex={c.hex} size="w-5 h-5" />
                <input
                  type="color"
                  value={c.hex}
                  onChange={(e) => setHex(c.name, e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label={`${c.name} shade`}
                />
              </label>
              {c.name}
              <button
                type="button"
                onClick={() => removeColor(c.name)}
                aria-label={`Remove ${c.name}`}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
              >
                <X className="w-3.5 h-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>

        {quickAdd.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            <span className="text-xs text-gray-500">Add a standard color:</span>
            <div className="flex flex-wrap gap-2">
              {quickAdd.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => addColor(c, tapeSwatch(c))}
                  className="flex items-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 px-2.5 py-1 text-gray-600 hover:border-[var(--color-primary)]"
                >
                  <Swatch hex={tapeSwatch(c)} />
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1 mt-1">
          <span className="text-xs text-gray-500">
            Or add your own (e.g. &quot;Neon green&quot;,
            &quot;Red/White&quot;):
          </span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              className="w-11 h-10 rounded border border-gray-300 shrink-0"
              aria-label="Shade for your color"
            />
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Color name"
              maxLength={30}
              className="border rounded-lg px-3 py-2 flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={() => {
                addColor(customName, customHex);
                if (customName.trim() && !has(customName.trim()))
                  setCustomName("");
              }}
              className="flex items-center gap-1 rounded-lg border-2 border-[var(--color-primary)] text-[var(--color-primary)] px-3 py-2 font-medium shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden /> Add
            </button>
          </div>
          {colorError && <p className="text-xs text-red-600">{colorError}</p>}
        </div>
      </section>

      {/* Most pieces */}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Most pieces of tape on a set</span>
        <span className="text-xs text-gray-500">
          Only used when the oar list below is empty.
        </span>
        <input
          type="number"
          min={1}
          max={20}
          value={maxRings}
          onChange={(e) =>
            setMaxRings(
              Math.max(
                1,
                Math.min(20, Math.trunc(Number(e.target.value) || 1)),
              ),
            )
          }
          className="border rounded-lg px-3 py-2 w-24"
        />
      </label>

      {/* Sets */}
      <section className="flex flex-col gap-2">
        <span className="font-medium">Oar sets</span>
        <span className="text-xs text-gray-500">
          Every set of oars the club owns, and who uses it. Oar sheets pick from
          this list and filter by squad. Leave it empty to let coxes pick any
          color and count.
        </span>

        {sets.length === 0 ? (
          <p className="text-gray-500">No oar sets yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sets.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border-2 border-gray-200 px-3 py-2 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5" aria-hidden>
                    {Array.from({ length: s.rings }, (_, i) => (
                      <Swatch
                        key={i}
                        hex={tapeSwatch(s.color, colors)}
                        size="w-3 h-3"
                      />
                    ))}
                  </span>
                  <span className="font-medium">
                    {s.rings} {s.color}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSets((cur) => cur.filter((x) => x.id !== s.id))
                    }
                    aria-label={`Remove ${s.rings} ${s.color}`}
                    className="ml-auto p-1.5 rounded hover:bg-gray-100 text-gray-500"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {OAR_GROUPS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() =>
                        updateSet(s.id, { groups: toggle(s.groups, g) })
                      }
                      aria-pressed={s.groups.includes(g)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${
                        s.groups.includes(g)
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                          : "border-gray-300 text-gray-600"
                      }`}
                    >
                      {OAR_GROUP_LABELS[g]}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={s.note}
                  onChange={(e) =>
                    updateSet(s.id, { note: e.target.value.slice(0, 60) })
                  }
                  placeholder="Note (optional), e.g. Concept2 smoothies"
                  className="border rounded-lg px-2 py-1 text-xs"
                />
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-lg border-2 border-dashed border-gray-300 px-3 py-3 flex flex-col gap-2 mt-1">
          <span className="font-medium">Add a set</span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="border rounded-lg px-2 py-2"
              aria-label="Tape color"
            >
              {colors.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={20}
              value={newRings}
              onChange={(e) =>
                setNewRings(Math.trunc(Number(e.target.value) || 1))
              }
              className="border rounded-lg px-2 py-2 w-20"
              aria-label="Pieces of tape"
            />
            <span className="text-gray-500">pieces</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {OAR_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setNewGroups((cur) => toggle(cur, g))}
                aria-pressed={newGroups.includes(g)}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  newGroups.includes(g)
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                {OAR_GROUP_LABELS[g]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={addSet}
            className="self-start flex items-center gap-1 rounded-lg border-2 border-[var(--color-primary)] text-[var(--color-primary)] px-3 py-1.5 font-medium"
          >
            <Plus className="w-4 h-4" aria-hidden /> Add {newRings} {newColor}
          </button>
          {setsError && <p className="text-xs text-red-600">{setsError}</p>}
        </div>
        <p className="text-xs text-gray-500">
          Changes save when you tap Save below.
        </p>
      </section>
    </div>
  );
}
