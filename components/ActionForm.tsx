"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { unwrapIfResult } from "@/lib/userError";

// A <form> for a server action used straight from a server page. Shows the
// action's message under the form if it fails (the live site would
// otherwise hide it) and keeps what was typed; clears the form once it
// works, like a plain server-action form does. A submit button with
// data-action="alt" runs altAction instead (e.g. "Reset to defaults").
export function ActionForm({
  action,
  altAction,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<unknown>;
  altAction?: (formData: FormData) => Promise<unknown>;
  className?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        const run = submitter?.dataset.action === "alt" && altAction ? altAction : action;
        const formData = new FormData(e.currentTarget, submitter);
        setError(null);
        startTransition(async () => {
          try {
            unwrapIfResult(await run(formData));
            formRef.current?.reset();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
          }
        });
      }}
    >
      <fieldset disabled={isPending} className="contents">
        {children}
      </fieldset>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
