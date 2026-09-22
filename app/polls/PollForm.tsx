"use client";

import { useRef, useState, useTransition } from "react";
import { createPoll } from "./actions";

export function PollForm({ coaches }: { coaches: { id: string; display_name: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [boardOnly, setBoardOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createPoll(formData);
        formRef.current?.reset();
        setOpen(false);
        setBoardOnly(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2"
      >
        New poll
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="border rounded-lg p-4 flex flex-col gap-3 max-w-md"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-medium">New poll</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>

      <input
        name="question"
        placeholder="Ask a question..."
        required
        className="border rounded px-3 py-2 text-sm"
      />

      <textarea
        name="options"
        placeholder={"Options, one per line:\nOption A\nOption B\nOption C"}
        required
        rows={4}
        className="border rounded px-3 py-2 text-sm"
      />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="allow_multiple" className="w-4 h-4" />
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
                  <input type="checkbox" name="invitee_id" value={c.id} />
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
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create poll"}
      </button>
    </form>
  );
}
