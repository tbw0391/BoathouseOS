"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EventType } from "@/lib/database.types";
import { calendarItemsByDay, dayKey, type CalendarEvent, type CalendarItem } from "@/lib/scheduleCalendar";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const DOT: Record<EventType, string> = {
  regatta: "bg-[var(--color-primary)]",
  practice: "bg-gray-400",
  meeting: "bg-amber-500",
  other: "bg-amber-500",
};

function timeLabel(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function itemHref(item: CalendarItem) {
  if (item.eventType === "regatta" && item.eventId) return `/lineups/${item.eventId}`;
  if (item.eventId && (item.eventType === "practice" || item.eventType === "regatta")) {
    return `/schedule/${item.eventType}`;
  }
  return null;
}

const noopSubscribe = () => () => {};

// Dates depend on the viewer's time zone, so this only renders in the
// browser (the server would draw the grid in UTC).
export function ScheduleCalendar({ events }: { events: CalendarEvent[] }) {
  const inBrowser = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!inBrowser) return <div className="max-w-md h-96" />;
  return <Calendar events={events} />;
}

function Calendar({ events }: { events: CalendarEvent[] }) {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => dayKey(today));

  // Six rows starting on the Sunday on or before the 1st.
  const gridStart = new Date(month);
  gridStart.setDate(1 - month.getDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 42);

  const byDay = useMemo(
    () => calendarItemsByDay(events, gridStart, gridEnd),
    // gridStart/gridEnd are derived from month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, month]
  );

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const todayKey = dayKey(today);
  const selectedItems = byDay.get(selected) ?? [];
  const selectedDate = new Date(`${selected}T00:00:00`);

  function shiftMonth(n: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(next);
    setSelected(
      next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()
        ? todayKey
        : dayKey(next)
    );
  }

  return (
    <div className="max-w-md">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="rounded p-2 hover:bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="font-semibold">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="rounded p-2 hover:bg-gray-100"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const k = dayKey(d);
          const items = byDay.get(k) ?? [];
          const types = [...new Set(items.map((i) => i.eventType))];
          const inMonth = d.getMonth() === month.getMonth();
          const isSelected = k === selected;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSelected(k)}
              className={`flex flex-col items-center gap-1 rounded-md py-1.5 text-sm ${
                isSelected
                  ? "bg-[var(--color-secondary)] text-white"
                  : k === todayKey
                    ? "border-2 border-[var(--color-primary)]"
                    : "hover:bg-gray-100"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              {d.getDate()}
              <span className="flex h-1.5 gap-0.5">
                {types.map((t) => (
                  <span
                    key={t}
                    className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : DOT[t]}`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-600 mb-2">
          {selectedDate.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h3>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing scheduled.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selectedItems.map((item) => {
              const href = itemHref(item);
              const body = (
                <div className="flex items-start gap-2 rounded-lg border p-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[item.eventType]}`} />
                  <div>
                    <p className="text-sm font-medium">
                      {item.title}
                      {!item.eventId && (
                        <span className="ml-1 text-xs font-normal text-gray-500">(regular time)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {timeLabel(item.start)}
                      {item.end ? ` – ${timeLabel(item.end)}` : ""}
                      {item.location ? ` · ${item.location}` : ""}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={item.key}>
                  {href ? (
                    <Link href={href} className="block hover:bg-gray-50 rounded-lg">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
