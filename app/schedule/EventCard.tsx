"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteScheduleEvent, updateScheduleEvent } from "./actions";
import type { EventType, ScheduleEvent } from "@/lib/database.types";
import { EventIcon } from "@/components/EventIcon";
import { placeEmoji } from "@/lib/raceResults";

const RECURRENCE_LABEL: Record<ScheduleEvent["recurrence"], string> = {
  none: "",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function formatWhen(startsAt: string, endsAt: string | null) {
  const start = new Date(startsAt);
  const startLabel = start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  if (!endsAt) return startLabel;
  const end = new Date(endsAt);
  const endLabel = end.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${startLabel} – ${endLabel}`;
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export function EventCard({
  event,
  eventType,
  canManage,
  medalPlace = null,
}: {
  event: ScheduleEvent;
  eventType: EventType;
  canManage: boolean;
  medalPlace?: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // The form just closes back to the display view on success, which is easy
  // to miss as a "did that work?" signal — this flashes an explicit
  // confirmation instead of forcing a jarring full page reload.
  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [justSaved]);

  function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateScheduleEvent(formData);
        setEditing(false);
        setJustSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Delete this event?")) return;
    setError(null);
    const formData = new FormData();
    formData.set("event_id", event.id);
    formData.set("event_type", eventType);
    startTransition(async () => {
      try {
        await deleteScheduleEvent(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (editing) {
    return (
      <form action={handleUpdate} className="flex flex-col gap-3 rounded-lg border p-4">
        <input type="hidden" name="event_id" value={event.id} />
        <input type="hidden" name="event_type" value={eventType} />
        <input
          name="title"
          defaultValue={event.title}
          required
          placeholder="Event title"
          className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
        />
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Starts
          <input
            type="datetime-local"
            name="starts_at"
            defaultValue={toLocalInputValue(event.starts_at)}
            required
            className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Ends (optional)
          <input
            type="datetime-local"
            name="ends_at"
            defaultValue={event.ends_at ? toLocalInputValue(event.ends_at) : ""}
            className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <input
          name="location"
          defaultValue={event.location ?? ""}
          placeholder="Location (optional)"
          className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
        />
        <textarea
          name="description"
          rows={3}
          defaultValue={event.description ?? ""}
          placeholder="Details (optional)"
          className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
        />
        {eventType === "regatta" && (
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            CrewTimer mobile ID (optional)
            <input
              name="crewtimer_mobile_id"
              defaultValue={event.crewtimer_mobile_id ?? ""}
              placeholder="e.g. r12967"
              className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
            />
            <span className="text-xs text-gray-400">
              From this regatta&apos;s crewtimer.com results link. Once set, race results for our
              coxed boats fill in automatically on the Lineups page.
            </span>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Repeats
          <select
            name="recurrence"
            defaultValue={event.recurrence}
            className="rounded-md border px-3 py-2 outline-none focus:border-[var(--color-primary)]"
          >
            <option value="none">Doesn&apos;t repeat</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="self-start rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="self-start rounded-md border px-4 py-2 text-sm font-medium text-gray-600"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const recurrenceLabel = RECURRENCE_LABEL[event.recurrence];
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-medium">
          <EventIcon title={event.title} iconUrl={event.icon_url} />
          {event.title}
          {medalPlace != null && medalPlace <= 3 && (
            <span title={`We finished in ${medalPlace === 1 ? "1st" : medalPlace === 2 ? "2nd" : "3rd"} place`}>
              {placeEmoji(medalPlace)}
            </span>
          )}
        </h3>
        <span className="whitespace-nowrap text-xs text-gray-500">
          {formatWhen(event.starts_at, event.ends_at)}
        </span>
      </div>
      {recurrenceLabel && (
        <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase text-gray-600">
          {recurrenceLabel}
        </span>
      )}
      {event.location && <p className="mt-1 text-xs text-gray-500">{event.location}</p>}
      {event.description && (
        <div className="mt-2 text-sm text-gray-600">
          {event.description.split("\n").map((line, i) =>
            line.trimEnd().endsWith("★") ? (
              <p key={i} className="rounded bg-yellow-100 px-1 font-semibold text-gray-900">
                {line}
              </p>
            ) : (
              <p key={i}>{line || " "}</p>
            )
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {justSaved && <p className="mt-2 text-sm font-medium text-green-600">✓ Saved</p>}
      {canManage && (
        <div className="mt-3 flex gap-3 border-t pt-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-gray-600 hover:text-black"
          >
            Edit event
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Delete event
          </button>
        </div>
      )}
    </div>
  );
}
