"use client";

import { useState, useTransition } from "react";
import { setBoardMember } from "./actions";

export function BoardMemberToggle({
  profileId,
  initialValue,
}: {
  profileId: string;
  initialValue: boolean;
}) {
  const [isBoardMember, setIsBoardMember] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !isBoardMember;
    setError(null);
    startTransition(async () => {
      try {
        await setBoardMember(profileId, next);
        setIsBoardMember(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="text-sm border-2 border-[#022e5d] rounded px-3 py-2 disabled:opacity-50"
      >
        {isBoardMember ? "Remove from board" : "Make board member"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
