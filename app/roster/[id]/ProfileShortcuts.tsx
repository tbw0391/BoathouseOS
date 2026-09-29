"use client";

import { unwrap } from "@/lib/userError";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { saveProfileButtonOrder } from "./actions";

type Button = { href: string; label: string };

// Shortcut buttons on your own profile. "Arrange" lets you move them with
// tap arrows, saved to your account.
export function ProfileShortcuts({ buttons, isCustom }: { buttons: Button[]; isCustom: boolean }) {
  const [arranging, setArranging] = useState(false);
  const [order, setOrder] = useState(buttons);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function move(index: number, by: -1 | 1) {
    setOrder((prev) => {
      const next = [...prev];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  function save(value: string[] | null) {
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await saveProfileButtonOrder(value));
        setArranging(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  }

  function cancel() {
    setOrder(buttons);
    setArranging(false);
    setError(null);
  }

  const shown = arranging ? order : buttons;

  return (
    <div className="mt-6 max-w-lg">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-gray-600">Shortcuts</h2>
        {arranging ? (
          <span className="flex gap-3 text-sm">
            {isCustom && (
              <button type="button" onClick={() => save(null)} disabled={isPending} className="text-gray-500 hover:underline">
                Reset
              </button>
            )}
            <button type="button" onClick={cancel} disabled={isPending} className="text-gray-500 hover:underline">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save(order.map((b) => b.href))}
              disabled={isPending}
              className="font-medium text-[var(--color-primary)] hover:underline"
            >
              {isPending ? "Saving..." : "Done"}
            </button>
          </span>
        ) : (
          buttons.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setOrder(buttons);
                setArranging(true);
              }}
              className="text-sm text-gray-500 hover:underline"
            >
              Arrange
            </button>
          )
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {shown.map((b, i) =>
          arranging ? (
            <div
              key={b.href}
              className="flex items-center justify-between gap-1 rounded-lg border-2 border-dashed border-[var(--color-primary)] px-1 py-1.5 text-sm font-medium"
            >
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${b.label} earlier`}
                className="p-1.5 rounded disabled:opacity-25"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden />
              </button>
              <span className="min-w-0 truncate text-center">{b.label}</span>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === shown.length - 1}
                aria-label={`Move ${b.label} later`}
                className="p-1.5 rounded disabled:opacity-25"
              >
                <ChevronRight className="w-5 h-5" aria-hidden />
              </button>
            </div>
          ) : (
            <Link
              key={b.href}
              href={b.href}
              className="rounded-lg border-2 border-[var(--color-primary)] bg-[var(--color-secondary)] text-white px-3 py-2.5 text-sm font-medium text-center hover:bg-[var(--color-accent)] transition-colors"
            >
              {b.label}
            </Link>
          )
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
