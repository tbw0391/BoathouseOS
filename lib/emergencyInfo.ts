import type { EmergencyInfo } from "@/lib/database.types";

export const EMERGENCY_TEXT_FIELDS = [
  "contact1_name",
  "contact1_relation",
  "contact1_phone",
  "contact2_name",
  "contact2_relation",
  "contact2_phone",
  "allergies",
  "medications",
  "medical_notes",
] as const;

export type EmergencyField = (typeof EMERGENCY_TEXT_FIELDS)[number];

// Missing = no way to reach anyone.
export function emergencyInfoMissing(info: Partial<EmergencyInfo> | null | undefined): boolean {
  return !info?.contact1_phone?.trim() && !info?.contact2_phone?.trim();
}

export function hasMedicalFlags(info: Partial<EmergencyInfo> | null | undefined): boolean {
  return !!(info?.allergies?.trim() || info?.medications?.trim() || info?.medical_notes?.trim());
}

// tel: link that works from a phone number typed any which way.
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// The first emergency contact with a phone number, for program registration.
export function primaryEmergencyContact(
  info: Partial<EmergencyInfo> | null | undefined
): { name: string; phone: string } | null {
  for (const [name, relation, phone] of [
    [info?.contact1_name, info?.contact1_relation, info?.contact1_phone],
    [info?.contact2_name, info?.contact2_relation, info?.contact2_phone],
  ]) {
    if (phone?.trim()) {
      const who = [name?.trim(), relation?.trim() && `(${relation.trim()})`].filter(Boolean).join(" ");
      return { name: who || "Emergency contact", phone: phone.trim() };
    }
  }
  return null;
}

// Allergies, medications and notes as one line.
export function medicalSummary(info: Partial<EmergencyInfo> | null | undefined): string | null {
  const parts = [
    info?.allergies?.trim() && `Allergies: ${info.allergies.trim()}`,
    info?.medications?.trim() && `Medications: ${info.medications.trim()}`,
    info?.medical_notes?.trim(),
  ].filter(Boolean);
  return parts.length ? parts.join(". ") : null;
}
