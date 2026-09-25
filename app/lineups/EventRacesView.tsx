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
  initialSelectedKey = null,
}: {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  items: RaceBoxItem[];
  boats: Boat[];
  canManage: boolean;
  starredCount: number;
  initialSelectedKey?: string | null;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(initialSelectedKey);

  function renderDetail(item: RaceBoxItem) {
    if (item.lineup) {
      return (
        <LineupDetail
          lineup={item.lineup}
          lineupSeats={item.lineupSeats}
          eligibleRoster={item.eligibleRoster}
          canManage={canManage}
        />
      );
    }
    if (item.raceId) {
      return canManage ? (
        <AssignBoatPanel raceId={item.raceId} boats={boats} category={item.category} />
      ) : (
        <p className="text-sm text-gray-500">Waiting on a coach to assign a boat.</p>
      );
    }
    return null;
  }

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
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.key} className="flex flex-col gap-2">
              <RaceBox
                item={item}
                selected={selectedKey === item.key}
                onClick={() => setSelectedKey(selectedKey === item.key ? null : item.key)}
              />
              {selectedKey === item.key && <div className="max-w-lg">{renderDetail(item)}</div>}
            </div>
          ))}
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
