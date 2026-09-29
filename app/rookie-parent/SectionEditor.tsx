"use client";

import { useState, useTransition } from "react";
import {
  deleteRookieParentSection,
  moveRookieParentSection,
  saveRookieParentSection,
} from "./actions";
import { unwrap, type ActionResult } from "@/lib/userError";
import type { RookieParentSection } from "@/lib/rookieParent";

function useSectionAction() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult<unknown>>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        unwrap(await action());
        onDone?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return { error, isPending, run };
}

function SectionForm({
  section,
  onDone,
}: {
  section: RookieParentSection | null;
  onDone: () => void;
}) {
  const { error, isPending, run } = useSectionAction();

  return (
    <form
      action={(formData) =>
        run(
          () =>
            saveRookieParentSection(
              section?.id ?? null,
              String(formData.get("title") ?? ""),
              String(formData.get("text") ?? ""),
            ),
          onDone,
        )
      }
      className="flex flex-col gap-2"
    >
      <input
        name="title"
        defaultValue={section?.title ?? ""}
        placeholder="Section title"
        className="border rounded px-3 py-2 text-sm font-medium"
      />
      <textarea
        name="text"
        rows={8}
        defaultValue={section?.text ?? ""}
        placeholder="What rookie parents should know"
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
        <button type="button" onClick={onDone} className="text-sm text-gray-500 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function SectionEditor({
  section,
  canEdit,
  isFirst,
  isLast,
}: {
  section: RookieParentSection;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { error, isPending, run } = useSectionAction();

  if (editing) {
    return <SectionForm section={section} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{section.title}</h2>
      {section.text ? (
        <div className="text-sm text-gray-700">
          {section.text.split("\n").map((line, i) => (
            <p key={i}>{line || " "}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Nothing here yet.</p>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-gray-600">
          <button type="button" onClick={() => setEditing(true)} className="hover:text-black">
            Edit
          </button>
          {!isFirst && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => moveRookieParentSection(section.id, "up"))}
              className="hover:text-black disabled:opacity-50"
            >
              Move up
            </button>
          )}
          {!isLast && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => moveRookieParentSection(section.id, "down"))}
              className="hover:text-black disabled:opacity-50"
            >
              Move down
            </button>
          )}
          {confirmingDelete ? (
            <>
              <span className="text-gray-500">Delete this section?</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => deleteRookieParentSection(section.id))}
                className="text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Yes, delete
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="hover:text-black">
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="text-red-600 hover:text-red-800">
              Delete
            </button>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function AddSection() {
  const [adding, setAdding] = useState(false);

  if (adding) {
    return <SectionForm section={null} onDone={() => setAdding(false)} />;
  }

  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="self-start rounded-lg border-2 border-dashed border-[var(--color-primary)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
    >
      + Add a section
    </button>
  );
}
