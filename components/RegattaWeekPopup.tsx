"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Megaphone, Tent, Waves, X } from "lucide-react";

export interface RegattaWeekLink {
  href: string;
  label: string;
  detail: string;
  icon: "food" | "lineups" | "messages";
}

const ICONS = { food: Tent, lineups: Waves, messages: Megaphone };

function storageKey(eventId: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return `regatta-week-${eventId}-${today}`;
}

// Pops up once a day during the week before a regatta with the three things
// to check. Dismissing hides it until tomorrow.
export function RegattaWeekPopup({
  eventId,
  heading,
  links,
}: {
  eventId: string;
  heading: string;
  links: RegattaWeekLink[];
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey(eventId)) === "1";
    } catch {}
    if (!seen) setOpen(true);
  }, [eventId]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // dismiss only touches storage and state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function dismiss() {
    try {
      localStorage.setItem(storageKey(eventId), "1");
    } catch {}
    setOpen(false);
  }

  if (!open || links.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="regatta-week-heading"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl text-gray-900"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="regatta-week-heading" className="text-lg font-bold">
            {heading}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {links.map((l) => {
            const Icon = ICONS[l.icon];
            return (
              <Link
                key={l.href + l.label}
                href={l.href}
                onClick={dismiss}
                className="flex items-center gap-3 rounded-lg border-2 border-[var(--color-primary)] px-4 py-3 hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex flex-col">
                  <span className="font-medium">{l.label}</span>
                  <span className="text-xs opacity-75">{l.detail}</span>
                </span>
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="mt-4 w-full rounded-lg bg-[var(--color-secondary)] border-2 border-[var(--color-primary)] px-4 py-2 font-medium text-white"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
