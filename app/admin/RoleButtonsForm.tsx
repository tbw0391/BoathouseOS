"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { unwrapIfResult } from "@/lib/userError";

type Button = { href: string; label: string };

// Pick a type of user, then tap which buttons they get. Used for both the
// home screen and the profile page.
export function RoleButtonsForm({
  groups,
  buttonsByGroup,
  initialAccess,
  onSave,
  savedMessage,
}: {
  groups: { key: string; label: string }[];
  buttonsByGroup: Record<string, Button[]>;
  initialAccess: Record<string, string[]>;
  onSave: (access: Record<string, string[]>) => Promise<unknown>;
  savedMessage: string;
}) {
  const [role, setRole] = useState(groups[0].key);
  const [access, setAccess] = useState(() =>
    Object.fromEntries(groups.map(({ key }) => [key, new Set(initialAccess[key] ?? [])])) as Record<
      string,
      Set<string>
    >
  );
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sections = buttonsByGroup[role] ?? [];
  const on = access[role];

  function toggle(href: string) {
    setAccess((prev) => {
      const next = new Set(prev[role]);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return { ...prev, [role]: next };
    });
    setDirty(true);
    setMessage(null);
  }

  function setAll(value: boolean) {
    setAccess((prev) => ({ ...prev, [role]: new Set(value ? sections.map((s) => s.href) : []) }));
    setDirty(true);
    setMessage(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        unwrapIfResult(await onSave(Object.fromEntries(groups.map(({ key }) => [key, [...access[key]]]))));
        setDirty(false);
        setMessage(savedMessage);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  }

  const roleLabel = groups.find((g) => g.key === role)!.label;

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Type of user">
        {groups.map((r) => (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={r.key === role}
            onClick={() => setRole(r.key)}
            className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
              r.key === role
                ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                : "border-gray-300 hover:border-[var(--color-primary)]"
            }`}
          >
            {r.label}
            <span className="ml-1.5 text-xs opacity-75">{access[r.key].size}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {roleLabel}s see {on.size} of {sections.length} buttons. Tap to turn on or off.
        </span>
        <span className="flex gap-3">
          <button type="button" onClick={() => setAll(true)} className="text-xs text-gray-600 hover:underline">
            All
          </button>
          <button type="button" onClick={() => setAll(false)} className="text-xs text-gray-600 hover:underline">
            None
          </button>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {sections.map((s) => {
          const isOn = on.has(s.href);
          return (
            <button
              key={s.href}
              type="button"
              onClick={() => toggle(s.href)}
              aria-pressed={isOn}
              className={`flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-2.5 text-left text-sm ${
                isOn
                  ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                  : "border-gray-300 text-gray-500"
              }`}
            >
              <span className="min-w-0 truncate">{s.label}</span>
              {isOn && <Check className="w-4 h-4 shrink-0" aria-hidden />}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={isPending || !dirty}
        className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors disabled:opacity-50"
      >
        {isPending ? "Saving..." : dirty ? "Save all groups" : "Saved"}
      </button>
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
