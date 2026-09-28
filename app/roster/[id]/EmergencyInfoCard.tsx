"use client";

import { useState, useTransition } from "react";
import type { EmergencyInfo } from "@/lib/database.types";
import { emergencyInfoMissing, telHref } from "@/lib/emergencyInfo";
import { saveEmergencyInfo } from "./emergencyActions";

export function EmergencyInfoCard({ profileId, info }: { profileId: string; info: EmergencyInfo | null }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const missing = emergencyInfoMissing(info);

  const input = (name: string, label: string, value: string | null | undefined, type = "text") => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <input name={name} type={type} defaultValue={value ?? ""} className="border rounded px-2 py-1" />
    </label>
  );
  const area = (name: string, label: string, value: string | null | undefined) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <textarea name={name} rows={2} defaultValue={value ?? ""} className="border rounded px-2 py-1" />
    </label>
  );

  return (
    <div className={`mt-6 max-w-lg rounded-lg border-2 p-4 ${missing ? "border-amber-500" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Emergency info</h2>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-sm underline">
            {info ? "Edit" : "Add"}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-2">Only this member, their parents, coaches and admins can see this.</p>

      {editing ? (
        <form
          className="flex flex-col gap-3"
          action={(fd) =>
            start(async () => {
              setError(null);
              try {
                await saveEmergencyInfo(profileId, fd);
                setEditing(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Couldn't save.");
              }
            })
          }
        >
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="text-sm font-medium mb-1">First contact</legend>
            {input("contact1_name", "Name", info?.contact1_name)}
            {input("contact1_relation", "Relationship", info?.contact1_relation)}
            {input("contact1_phone", "Phone", info?.contact1_phone, "tel")}
          </fieldset>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="text-sm font-medium mb-1">Second contact</legend>
            {input("contact2_name", "Name", info?.contact2_name)}
            {input("contact2_relation", "Relationship", info?.contact2_relation)}
            {input("contact2_phone", "Phone", info?.contact2_phone, "tel")}
          </fieldset>
          {area("allergies", "Allergies", info?.allergies)}
          {area("medications", "Medications (e.g. inhaler, EpiPen)", info?.medications)}
          {area("medical_notes", "Anything else coaches should know (asthma, diabetes, can't swim…)", info?.medical_notes)}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm underline">
              Cancel
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      ) : missing && !info?.allergies && !info?.medical_notes ? (
        <p className="text-sm text-amber-700">No emergency contact yet. Please add one.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {[1, 2].map((n) => {
            const name = n === 1 ? info?.contact1_name : info?.contact2_name;
            const rel = n === 1 ? info?.contact1_relation : info?.contact2_relation;
            const phone = n === 1 ? info?.contact1_phone : info?.contact2_phone;
            if (!name && !phone) return null;
            return (
              <div key={n} className="contents">
                <dt className="text-gray-500">Contact {n}</dt>
                <dd>
                  {name}
                  {rel && ` (${rel})`}
                  {phone && (
                    <>
                      {" · "}
                      <a href={telHref(phone)} className="underline">
                        {phone}
                      </a>
                    </>
                  )}
                </dd>
              </div>
            );
          })}
          {info?.allergies && (
            <>
              <dt className="text-gray-500">Allergies</dt>
              <dd className="text-red-700 font-medium">{info.allergies}</dd>
            </>
          )}
          {info?.medications && (
            <>
              <dt className="text-gray-500">Medications</dt>
              <dd>{info.medications}</dd>
            </>
          )}
          {info?.medical_notes && (
            <>
              <dt className="text-gray-500">Notes</dt>
              <dd className="whitespace-pre-line">{info.medical_notes}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
