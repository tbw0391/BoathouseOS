"use client";

import { useState } from "react";
import { PollManageControls } from "./PollManageControls";
import { EditPollForm } from "./EditPollForm";
import { VoteControl } from "./VoteControl";
import type { Poll } from "@/lib/database.types";

export function PollCard({
  poll,
  options,
  optionVotes,
  myOptionIds,
  canManageThis,
  closed,
  coaches,
  inviteeIds,
  inviteeNames,
}: {
  poll: Poll;
  options: { id: string; label: string }[];
  optionVotes: { optionId: string; count: number; voterNames: string }[];
  myOptionIds: string[];
  canManageThis: boolean;
  closed: boolean;
  coaches: { id: string; display_name: string }[];
  inviteeIds: string[];
  inviteeNames: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="border rounded-lg p-4">
        <EditPollForm
          poll={poll}
          options={options}
          coaches={coaches}
          inviteeIds={inviteeIds}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{poll.question}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {poll.allow_multiple ? "Pick as many as you like" : "Pick one"}
            {poll.board_only && " · Board only"}
            {closed && " · Closed"}
          </p>
          {poll.board_only && inviteeNames && (
            <p className="text-xs text-gray-500">Also invited: {inviteeNames}</p>
          )}
        </div>
        {canManageThis && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-xs border rounded px-2 py-1"
            >
              Edit
            </button>
            <PollManageControls pollId={poll.id} closed={closed} />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {options.map((option) => {
          const ov = optionVotes.find((v) => v.optionId === option.id);
          const count = ov?.count ?? 0;
          return (
            <div key={option.id} className="text-sm">
              <p>
                {option.label}{" "}
                <span className="text-gray-500">
                  — {count} {count === 1 ? "vote" : "votes"}
                </span>
              </p>
              {ov?.voterNames && <p className="text-xs text-gray-500">{ov.voterNames}</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <VoteControl
          pollId={poll.id}
          options={options}
          allowMultiple={poll.allow_multiple}
          myOptionIds={myOptionIds}
          closed={closed}
        />
      </div>
    </div>
  );
}
