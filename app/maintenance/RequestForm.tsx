"use client";

import { useRef, useState, useTransition } from "react";
import { submitMaintenanceRequest } from "./actions";
import type { Boat, MaintenanceType } from "@/lib/database.types";

export function RequestForm({
  type,
  boats,
  placeholder,
}: {
  type: MaintenanceType;
  boats?: Boat[];
  placeholder: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSubmitted(false);
    startTransition(async () => {
      try {
        await submitMaintenanceRequest(type, formData);
        formRef.current?.reset();
        setSubmitted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex flex-col gap-3 max-w-md border rounded-lg p-4"
    >
      {type === "boat" && (
        <select name="boat_id" defaultValue="" required className="border rounded px-3 py-2 text-sm">
          <option value="" disabled>
            Which boat?
          </option>
          {(boats ?? []).map((boat) => (
            <option key={boat.id} value={boat.id}>
              {boat.name}
            </option>
          ))}
        </select>
      )}

      <textarea
        name="description"
        required
        rows={4}
        placeholder={placeholder}
        className="border rounded px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {submitted && <p className="text-sm text-green-700">Thanks! Your request was submitted.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50 self-start"
      >
        {isPending ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}
