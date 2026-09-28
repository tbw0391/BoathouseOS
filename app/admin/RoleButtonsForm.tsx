"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { NAV_ROLES, navSectionsFor, type NavRole } from "@/lib/navSections";
import { updateNavAccess } from "./actions";

// Pick a type of user, then tap which home-screen buttons they get.
export function RoleButtonsForm({ initialAccess }: { initialAccess: Record<NavRole, string[]> }) {
  const [role, setRole] = useState<NavRole>("rower");
  const [access, setAccess] = useState(() =>
    Object.fromEntries(NAV_ROLES.map(({ role: r }) => [r, new Set(initialAccess[r])])) as Record<
      NavRole,
      Set<string>
    >
  );
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sections = navSectionsFor(role);
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
        await updateNavAccess(
          Object.fromEntries(NAV_ROLES.map(({ role: r }) => [r, [...access[r]]])) as Record<NavRole, string[]>
        );
        setDirty(false);
        setMessage("Saved. Everyone sees the change next time they open the home screen.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  }

  const roleLabel = NAV_ROLES.find((r) => r.role === role)!.label;

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Type of user">
        {NAV_ROLES.map((r) => (
          <button
            key={r.role}
            type="button"
            role="tab"
            aria-selected={r.role === role}
            onClick={() => setRole(r.role)}
            className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
              r.role === role
                ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                : "border-gray-300 hover:border-[var(--color-primary)]"
            }`}
          >
            {r.label}
            <span className="ml-1.5 text-xs opacity-75">{access[r.role].size}</span>
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
        {isPending ? "Saving..." : dirty ? "Save all roles" : "Saved"}
      </button>
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
