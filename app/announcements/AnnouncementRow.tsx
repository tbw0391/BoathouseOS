"use client";

import { useTransition } from "react";
import { deleteAnnouncement } from "./actions";
import type { CoachAnnouncement } from "@/lib/database.types";

const AUDIENCE_LABEL: Record<CoachAnnouncement["audience"], string> = {
  rowers: "Rowers",
  parents: "Parents",
  both: "Everyone",
};

export function AnnouncementRow({
  announcement,
  senderName,
  canManage,
}: {
  announcement: CoachAnnouncement;
  senderName: string;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm("Delete this announcement?")) return;
    startTransition(async () => {
      await deleteAnnouncement(announcement.id);
    });
  }

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-2">
      <span className="self-start text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5 bg-gray-100 text-gray-600">
        {AUDIENCE_LABEL[announcement.audience]}
      </span>
      <p className="text-sm whitespace-pre-wrap">{announcement.message}</p>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {senderName} · {new Date(announcement.created_at).toLocaleDateString()}
        </span>
        {canManage && (
          <button
            onClick={remove}
            disabled={isPending}
            className="border border-red-600 text-red-600 rounded px-2 py-1 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
