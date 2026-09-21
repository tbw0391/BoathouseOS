"use client";

import { useTransition } from "react";
import { assignSeat } from "./actions";
import type { Profile } from "@/lib/database.types";

export function SeatAssign({
  seatId,
  currentRowerId,
  roster,
  onAssign = assignSeat,
}: {
  seatId: string;
  currentRowerId: string | null;
  roster: Pick<Profile, "id" | "display_name">[];
  onAssign?: (seatId: string, rowerId: string | null) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const rowerId = e.target.value || null;
    startTransition(async () => {
      await onAssign(seatId, rowerId);
    });
  }

  return (
    <select
      defaultValue={currentRowerId ?? ""}
      onChange={handleChange}
      disabled={isPending}
      className="border rounded px-2 py-1 text-sm disabled:opacity-50"
    >
      <option value="">— empty —</option>
      {roster.map((p) => (
        <option key={p.id} value={p.id}>
          {p.display_name}
        </option>
      ))}
    </select>
  );
}
