"use client";

import Link from "next/link";
import { useState } from "react";
import type { EmergencyInfo } from "@/lib/database.types";
import { emergencyInfoMissing, hasMedicalFlags, telHref } from "@/lib/emergencyInfo";

export type EmergencyRow = {
  id: string;
  name: string;
  role: string;
  ownPhone: string | null;
  onWater: boolean;
  info: EmergencyInfo | null;
};

export function EmergencyList({ rows }: { rows: EmergencyRow[] }) {
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const q = query.trim().toLowerCase();
  const missingCount = rows.filter((r) => emergencyInfoMissing(r.info)).length;
  const shown = rows.filter(
    (r) => (!q || r.name.toLowerCase().includes(q)) && (!onlyMissing || emergencyInfoMissing(r.info))
  );

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find someone"
        className="border rounded px-3 py-2"
      />
      {missingCount > 0 && (
        <button
          type="button"
          onClick={() => setOnlyMissing(!onlyMissing)}
          className={`self-start rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
            onlyMissing ? "border-amber-500 bg-amber-500 text-white" : "border-amber-500 text-amber-700"
          }`}
        >
          {missingCount} with no emergency contact
        </button>
      )}
      {shown.map((r) => {
        const i = r.info;
        const contacts = [
          { name: i?.contact1_name, rel: i?.contact1_relation, phone: i?.contact1_phone },
          { name: i?.contact2_name, rel: i?.contact2_relation, phone: i?.contact2_phone },
        ].filter((c) => c.name || c.phone);
        return (
          <div
            key={r.id}
            className={`rounded-lg border-2 p-3 text-sm ${emergencyInfoMissing(i) ? "border-amber-500" : "border-gray-200"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <Link href={`/roster/${r.id}`} className="font-semibold hover:underline">
                {r.name}
              </Link>
              <span className="flex gap-1">
                {r.onWater && <span className="text-xs rounded-full bg-blue-100 text-blue-800 px-2 py-0.5">On the water</span>}
                {hasMedicalFlags(i) && <span className="text-xs rounded-full bg-red-100 text-red-800 px-2 py-0.5">Medical</span>}
              </span>
            </div>
            {contacts.length === 0 ? (
              <p className="text-amber-700 mt-1">No emergency contact on file.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1">
                {contacts.map((c, n) => (
                  <li key={n} className="flex items-center justify-between gap-2">
                    <span>
                      {c.name}
                      {c.rel && <span className="text-gray-500"> ({c.rel})</span>}
                    </span>
                    {c.phone && (
                      <a href={telHref(c.phone)} className="shrink-0 rounded bg-green-700 text-white px-3 py-1 font-medium">
                        Call {c.phone}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {i?.allergies && <p className="mt-1 text-red-700"><span className="font-medium">Allergies:</span> {i.allergies}</p>}
            {i?.medications && <p className="mt-1"><span className="font-medium">Medications:</span> {i.medications}</p>}
            {i?.medical_notes && <p className="mt-1 whitespace-pre-line"><span className="font-medium">Notes:</span> {i.medical_notes}</p>}
          </div>
        );
      })}
      {shown.length === 0 && <p className="text-sm text-gray-500">No one matches.</p>}
    </div>
  );
}
