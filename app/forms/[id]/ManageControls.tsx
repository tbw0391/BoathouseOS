"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { closeForm, deleteForm, reopenForm } from "../actions";
import { unwrap, type ActionResult } from "@/lib/userError";

// Edit / Results / Close / Delete for whoever manages a form. Delete takes
// a second tap.
export function ManageControls({
  formId,
  open,
  answerCount,
  election,
}: {
  formId: string;
  open: boolean;
  answerCount: number;
  election: boolean;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult<unknown>>, after?: () => void) => {
    setError(null);
    start(async () => {
      try {
        unwrap(await fn());
        after?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  };

  const button = "text-sm border rounded px-3 py-1.5 disabled:opacity-50";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Link href={`/forms/${formId}/results`} className={button}>
          {election ? "Turnout & results" : "Responses"} ({answerCount})
        </Link>
        <Link href={`/forms/${formId}/edit`} className={button}>
          Edit
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => (open ? closeForm(formId) : reopenForm(formId)))}
          className={button}
        >
          {open ? "Close now" : "Reopen"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            confirmDelete ? run(() => deleteForm(formId), () => router.push("/forms")) : setConfirmDelete(true)
          }
          className={`${button} text-red-600 border-red-300`}
        >
          {confirmDelete ? "Tap again to delete" : "Delete"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
