"use client";

import { useState } from "react";
import { RaceBox } from "./RaceBox";
import { LineupDetail } from "./LineupDetail";
import { AssignBoatPanel } from "./AssignBoatPanel";
import { AddRacesPanel } from "./AddRacesPanel";
import type { RaceBoxItem } from "./raceBoxTypes";
import type { Boat } from "@/lib/database.types";

export function EventRacesView({
  eventId,
  items,
  boats,
  canManage,
  pendingStarredLines,
  hasResultsFeed,
  initialSelectedKey = null,
}: {
  eventId: string;
  items: RaceBoxItem[];
  boats: Boat[];
  canManage: boolean;
  pendingStarredLines: string[];
  hasResultsFeed: boolean;
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
    <div>
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
        <div className="mt-6 max-w-lg">
          <AddRacesPanel
            eventId={eventId}
            boats={boats}
            hasResultsFeed={hasResultsFeed}
            pendingStarredLines={pendingStarredLines}
          />
        </div>
      )}
    </div>
  );
}
