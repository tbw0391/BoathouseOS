"use client";

import { useState, useTransition } from "react";
import { setEmailAlerts } from "@/app/notifications/actions";
import { unwrap } from "@/lib/userError";

// Beside the phone-alerts prompt on the home page: important alerts
// (lightning, practice calls, launch times, payments) are emailed when phone
// alerts are off.
export function EmailAlertsToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-start gap-2 rounded-lg border-2 border-gray-200 px-4 py-3 text-sm cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 w-5 h-5 shrink-0"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            try {
              unwrap(await setEmailAlerts(next));
            } catch {
              setOn(!next);
            }
          });
        }}
      />
      Email me important alerts when phone alerts are off
    </label>
  );
}
