"use client";

import { useState } from "react";
import Link from "next/link";
import { RaceBox } from "./RaceBox";
import { LineupDetail } from "./LineupDetail";
import { AssignBoatPanel } from "./AssignBoatPanel";
import { CreateLineupForm } from "./CreateLineupForm";
import { ImportRacesForm } from "./ImportRacesForm";
import { ImportStarredRacesButton } from "./ImportStarredRacesButton";
import type { RaceBoxItem } from "./raceBoxTypes";
import type { Boat } from "@/lib/database.types";

export function EventRacesView({
  eventId,
  eventTitle,
  eventDate,
  items,
  boats,
  canManage,
  starredCount,
}: {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  items: RaceBoxItem[];
  boats: Boat[];
  canManage: boolean;
  starredCount: number;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = items.find((i) => i.key === selectedKey) ?? null;

  return (
    <div className="min-h-screen p-8">
      <Link href="/lineups" className="text-sm text-gray-500 hover:underline">
        ← Lineups
      </Link>
      <h1 className="text-2xl font-bold mt-4">{eventTitle}</h1>
      <p className="text-sm text-gray-500 mb-6">{eventDate}</p>

      {canManage && starredCount > 0 && (
        <ImportStarredRacesButton eventId={eventId} count={starredCount} />
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No races or boats yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-w-3xl">
          {items.map((item) => (
            <RaceBox
              key={item.key}
              item={item}
              selected={selectedKey === item.key}
              onClick={() => setSelectedKey(selectedKey === item.key ? null : item.key)}
            />
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-4 max-w-lg">
          {selected.lineup ? (
            <LineupDetail
              lineup={selected.lineup}
              lineupSeats={selected.lineupSeats}
              eligibleRoster={selected.eligibleRoster}
              canManage={canManage}
            />
          ) : selected.raceId ? (
            canManage ? (
              <AssignBoatPanel raceId={selected.raceId} boats={boats} />
            ) : (
              <p className="text-sm text-gray-500">Waiting on a coach to assign a boat.</p>
            )
          ) : null}
        </div>
      )}

      {canManage && (
        <div className="mt-6 max-w-lg flex flex-col gap-3">
          <ImportRacesForm eventId={eventId} />
          <CreateLineupForm eventId={eventId} boats={boats} />
        </div>
      )}
    </div>
  );
}
