"use client";

import { useState, useTransition } from "react";
import { updateRookieParentSection } from "./actions";
import { unwrap } from "@/lib/userError";

export function SectionEditor({
  settingKey,
  text,
  canEdit,
}: {
  settingKey: string;
  text: string | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await updateRookieParentSection(settingKey, String(formData.get("text") ?? "")));
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (editing) {
    return (
      <form action={handleSubmit} className="flex flex-col gap-2">
        <textarea
          name="text"
          rows={8}
          defaultValue={text ?? ""}
          className="border rounded px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {text ? (
        <div className="text-sm text-gray-700">
          {text.split("\n").map((line, i) => (
            <p key={i}>{line || " "}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Nothing here yet.</p>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="self-start text-xs font-medium text-gray-600 hover:text-black"
        >
          {text ? "Edit" : "Add"}
        </button>
      )}
    </div>
  );
}
