"use client";

import { useState, useTransition } from "react";
import { Car } from "lucide-react";
import { unwrap } from "@/lib/userError";
import { saveTravelConsent } from "./travelConsentActions";

export type TravelConsent = {
  club_travel: boolean;
  one_on_one: boolean;
  given_by_name: string;
  given_at: string;
  expires_on: string;
};

const day = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// SafeSport travel consent for a rower or cox under 18: a parent's yearly
// written OK for club-arranged travel and, separately, for riding alone with
// an adult who isn't their parent. Parents and admins change it; coaches see it.
export function TravelConsentCard({
  rowerId,
  firstName,
  consent,
  today,
  canChange,
}: {
  rowerId: string;
  firstName: string;
  consent: TravelConsent | null;
  today: string;
  canChange: boolean;
}) {
  const current = consent && consent.expires_on >= today ? consent : null;
  const [clubTravel, setClubTravel] = useState(current?.club_travel ?? false);
  const [oneOnOne, setOneOnOne] = useState(current?.one_on_one ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        unwrap(await saveTravelConsent(rowerId, clubTravel, oneOnOne));
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  }

  return (
    <div className="mt-6 max-w-lg rounded-lg border-2 border-gray-200 p-4 flex flex-col gap-2">
      <h2 className="font-semibold flex items-center gap-2">
        <Car className="w-5 h-5" aria-hidden />
        Travel consent
      </h2>
      {current && (current.club_travel || current.one_on_one) ? (
        <p className="text-sm">
          Given by {current.given_by_name || "a parent"} on {day(current.given_at)}, good until{" "}
          {day(current.expires_on)}.
        </p>
      ) : consent ? (
        <p className="text-sm text-red-700">Expired {day(consent.expires_on)}. A parent needs to renew it.</p>
      ) : (
        <p className="text-sm text-gray-600">
          SafeSport rules need a parent&apos;s OK each year before {firstName} rides in club-arranged travel, like
          the rides on a regatta&apos;s Travel tab.
        </p>
      )}

      {canChange ? (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={clubTravel}
              onChange={(e) => setClubTravel(e.target.checked)}
              className="w-4 h-4 mt-0.5"
            />
            <span>
              {firstName} may ride in club-arranged travel (team buses and the rides parents and coaches offer on
              the Travel tab).
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={oneOnOne}
              onChange={(e) => setOneOnOne(e.target.checked)}
              className="w-4 h-4 mt-0.5"
            />
            <span>
              {firstName} may also ride alone with an adult driver who isn&apos;t their parent (no other adult or
              rowers in the car).
            </span>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={save}
              className="rounded bg-[var(--color-primary)] text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {clubTravel || oneOnOne ? "Save (good for one year)" : "Withdraw consent"}
            </button>
            {saved && <span className="text-sm text-green-700">Saved.</span>}
          </div>
          <p className="text-xs text-gray-500">
            Saving records your name and today&apos;s date as your written consent. You can change or withdraw it
            any time.
          </p>
        </>
      ) : (
        current && (
          <ul className="text-sm list-disc pl-5">
            <li>Club-arranged travel: {current.club_travel ? "yes" : "no"}</li>
            <li>Alone with an adult driver: {current.one_on_one ? "yes" : "no"}</li>
          </ul>
        )
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
