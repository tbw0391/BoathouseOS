"use client";

import { useState, useTransition } from "react";
import { importMembers, type ImportRow } from "./importActions";

function normalizeKey(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

export function ImportForm() {
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

      const rows: ImportRow[] = rawRows.map((raw) => {
        const normalized: Record<string, string> = {};
        for (const [key, value] of Object.entries(raw)) {
          normalized[normalizeKey(key)] = String(value ?? "").trim();
        }
        return {
          first_name: normalized.first_name ?? normalized.firstname,
          last_name: normalized.last_name ?? normalized.lastname,
          email: normalized.email,
          role: normalized.role,
          team: normalized.team ?? normalized.group,
          boat_side: normalized.boat_side ?? normalized.side,
          phone: normalized.phone,
        };
      });

      startTransition(async () => {
        try {
          const res = await importMembers(rows);
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
        Import from Excel
      </button>
    );
  }

  return (
    <div className="mt-4 border rounded-lg p-4 flex flex-col gap-3 max-w-md">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Import from Excel</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:underline"
        >
          Close
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Columns expected (case-insensitive): First Name, Last Name, Email,
        Role, Group, Boat Side, Phone. Group can list more than one, separated
        by commas (e.g. &quot;mens, womens&quot;) for people on multiple
        squads. Only First Name, Last Name, and Email are required. Imported
        members are added to the roster without a login — use &quot;Add
        member&quot; individually if you need to send them an invite.
      </p>

      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFile}
        className="text-sm"
      />

      {isPending && <p className="text-sm text-gray-500">Importing...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="text-sm">
          <p className="text-green-700">Imported {result.imported} member(s).</p>
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
