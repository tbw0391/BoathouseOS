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
