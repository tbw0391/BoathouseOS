// Birthdays (2026-10-03, Todd): a club can let parents give just the month
// and day. The database column is a date, so a birthday with no year is
// stored in NO_YEAR (a leap year, so Feb 29 works) and never shown as a year.
// Set by admins in /admin → Birthdays, stored in club_settings
// "birthday_settings" as { parentsNoYear: boolean } (missing = off).

export const BIRTHDAY_SETTINGS_KEY = "birthday_settings";
export const NO_YEAR = 1904;

export interface BirthdaySettings {
  parentsNoYear: boolean;
}

export function parseBirthdaySettings(raw: string | null | undefined): BirthdaySettings {
  try {
    const saved = JSON.parse(raw ?? "null") as Partial<BirthdaySettings> | null;
    return { parentsNoYear: saved?.parentsNoYear === true };
  } catch {
    return { parentsNoYear: false };
  }
}

// Whether this person's birthday is asked and shown as month and day only.
export function monthDayOnly(role: string, settings: BirthdaySettings): boolean {
  return role === "parent" && settings.parentsNoYear;
}

export function birthdayHasYear(birthday: string | null | undefined): boolean {
  return !!birthday && /^\d{4}-\d{2}-\d{2}$/.test(birthday) && Number(birthday.slice(0, 4)) !== NO_YEAR;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const MONTH_NAMES: readonly string[] = MONTHS;

// "October 4" or "October 4, 1980".
export function birthdayLabel(birthday: string | null | undefined, hideYear = false): string | null {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
  const [y, m, d] = birthday.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  const md = `${MONTHS[m - 1]} ${d}`;
  return hideYear || y === NO_YEAR ? md : `${md}, ${y}`;
}

// A month-and-day birthday from the form, stored as NO_YEAR-MM-DD. Null when
// not both given; throws on an impossible date like April 31.
export function monthDayBirthday(monthRaw: string, dayRaw: string): string | null {
  const m = Number(monthRaw);
  const d = Number(dayRaw);
  if (!monthRaw || !dayRaw) return null;
  const days = new Date(Date.UTC(NO_YEAR, m, 0)).getUTCDate();
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(d) || d < 1 || d > days) {
    throw new RangeError("That day isn't in that month.");
  }
  return `${NO_YEAR}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// For anything that needs a real date of birth (program sign-ups): null when
// only the month and day are known.
export function fullBirthdate(birthday: string | null | undefined): string | null {
  return birthdayHasYear(birthday) ? (birthday as string) : null;
}
