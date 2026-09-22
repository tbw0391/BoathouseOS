"use client";

import { useState, useTransition } from "react";
import { updatePoll } from "./actions";
import type { Poll } from "@/lib/database.types";

export function EditPollForm({
  poll,
  options,
  coaches,
  inviteeIds,
  onCancel,
  onSaved,
}: {
  poll: Poll;
  options: { id: string; label: string }[];
  coaches: { id: string; display_name: string }[];
  inviteeIds: string[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [boardOnly, setBoardOnly] = useState(poll.board_only);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("poll_id", poll.id);
    startTransition(async () => {
      try {
        await updatePoll(formData);
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Edit poll</h2>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:underline">
          Cancel
        </button>
      </div>

      <input
        name="question"
        defaultValue={poll.question}
        placeholder="Ask a question..."
        required
        className="border rounded px-3 py-2 text-sm"
      />

      <textarea
        name="options"
        defaultValue={options.map((o) => o.label).join("\n")}
        required
        rows={4}
        className="border rounded px-3 py-2 text-sm"
      />
      <p className="text-xs text-gray-500 -mt-2">
        One option per line. Removing an option deletes its votes; unchanged labels keep theirs.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="allow_multiple" defaultChecked={poll.allow_multiple} className="w-4 h-4" />
        Let people pick more than one option
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="board_only"
          checked={boardOnly}
          onChange={(e) => setBoardOnly(e.target.checked)}
          className="w-4 h-4"
        />
        Board members only
      </label>

      {boardOnly && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-500">
            Only board members (and admins) can see this poll. Optionally also invite specific
            coaches:
          </p>
          {coaches.length === 0 ? (
            <p className="text-xs text-gray-500">No coaches on the roster.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto border rounded p-2">
              {coaches.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="invitee_id"
                    value={c.id}
                    defaultChecked={inviteeIds.includes(c.id)}
                  />
                  {c.display_name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="self-start bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
