"use client";

import { useState, useTransition } from "react";
import { importVolunteerNeeds, type VolunteerNeedImportRow } from "./actions";

function normalizeKey(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

export function ImportNeedsForm({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setResult(null);

    try {
      const { read, utils } = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: "",
      });

      const rows: VolunteerNeedImportRow[] = rawRows.map((raw) => {
        const normalized: Record<string, string> = {};
        for (const [key, value] of Object.entries(raw)) {
          normalized[normalizeKey(key)] = String(value ?? "").trim();
        }
        return {
          title: normalized.title ?? normalized.task ?? normalized.name,
          slots_needed: normalized.slots_needed ?? normalized.slots ?? normalized.people_needed,
          description: normalized.description ?? normalized.notes,
        };
      });

      startTransition(async () => {
        try {
          const res = await importVolunteerNeeds(eventId, rows);
          setResult(res);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Import failed.");
        }
      });
    } catch {
      setError("Couldn't read that file. Make sure it's a .xlsx or .csv file.");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm border-2 border-[var(--color-primary)] rounded px-3 py-2"
      >
        Import slots from Excel
      </button>
    );
  }

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-3 max-w-md">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Import slots from Excel</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:underline"
        >
          Close
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Columns expected (case-insensitive): Title (or Task/Name), Slots
        Needed (or Slots/People Needed), Description (or Notes). Only Title
        is required — slots needed defaults to 1. Each row adds a new
        volunteer slot for this event.
      </p>

      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="text-sm" />

      {isPending && <p className="text-sm text-gray-500">Importing...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="text-sm">
          <p className="text-green-700">Added {result.imported} slot(s).</p>
          {result.errors.length > 0 && (
            <ul className="text-red-600 list-disc list-inside mt-1">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
