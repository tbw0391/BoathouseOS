import { describe, expect, it } from "vitest";
import { medicalSummary, primaryEmergencyContact } from "@/lib/emergencyInfo";
import { formatPrice, formatProgramDates, parseProgramQuestions, programState, spotsLeft } from "@/lib/programs";

describe("programState", () => {
  const now = new Date("2027-05-01T12:00:00Z");
  it("is a draft until published", () => {
    expect(programState({ published: false, opens_at: null, closes_at: null }, now)).toBe("draft");
  });
  it("follows the open and close times", () => {
    expect(programState({ published: true, opens_at: "2027-05-02T00:00:00Z", closes_at: null }, now)).toBe("not_yet");
    expect(programState({ published: true, opens_at: null, closes_at: "2027-05-01T11:00:00Z" }, now)).toBe("closed");
    expect(programState({ published: true, opens_at: "2027-04-01T00:00:00Z", closes_at: "2027-06-01T00:00:00Z" }, now)).toBe("open");
  });
});

describe("program display", () => {
  it("formats prices", () => {
    expect(formatPrice(null)).toBeNull();
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(15000)).toBe("$150");
    expect(formatPrice(12550)).toBe("$125.50");
  });
  it("formats date ranges", () => {
    expect(formatProgramDates("2027-06-14", "2027-06-18")).toBe("Jun 14 – Jun 18, 2027");
    expect(formatProgramDates("2027-12-28", "2028-01-02")).toBe("Dec 28, 2027 – Jan 2, 2028");
    expect(formatProgramDates("2027-06-14", null)).toBe("Jun 14, 2027");
    expect(formatProgramDates(null, null)).toBeNull();
  });
  it("counts spots left", () => {
    expect(spotsLeft(null, 50)).toBeNull();
    expect(spotsLeft(20, 18)).toBe(2);
    expect(spotsLeft(20, 25)).toBe(0);
  });
});

describe("parseProgramQuestions", () => {
  it("keeps good questions and drops broken ones", () => {
    expect(
      parseProgramQuestions([
        { id: "a", label: "Size", kind: "choice", options: ["S", "M", ""], required: true },
        { id: "b", label: "", kind: "short" },
        { id: "c", label: "Bad", kind: "file" },
        "junk",
      ])
    ).toEqual([{ id: "a", label: "Size", kind: "choice", options: ["S", "M"], required: true }]);
    expect(parseProgramQuestions(null)).toEqual([]);
  });
});

describe("registration details from the profile", () => {
  it("uses the first emergency contact with a phone", () => {
    expect(primaryEmergencyContact({ contact1_name: "Al", contact2_name: "Bea", contact2_relation: "Aunt", contact2_phone: "555-1" })).toEqual({
      name: "Bea (Aunt)",
      phone: "555-1",
    });
    expect(primaryEmergencyContact({ contact1_name: "Al" })).toBeNull();
  });
  it("joins medical notes", () => {
    expect(medicalSummary({ allergies: "Bees", medications: "", medical_notes: "Asthma" })).toBe("Allergies: Bees. Asthma");
    expect(medicalSummary(null)).toBeNull();
  });
});
