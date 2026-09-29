"use client";

import { useState, useTransition } from "react";
import { setEmailAlerts } from "@/app/notifications/actions";
import { unwrap } from "@/lib/userError";

// Small line under the phone-alerts prompt: important alerts (lightning,
// practice calls, launch times, payments) are emailed when phone alerts
// are off.
export function EmailAlertsToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-xs text-gray-500">
      <input
        type="checkbox"
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
