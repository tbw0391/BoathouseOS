// Builds an iCalendar (.ics) feed for phone calendar apps. Times are written
// in club time (America/New_York) with its time zone rules included, so
// repeating events stay at the same wall-clock time across daylight saving.

import { CLUB_TIME_ZONE } from "@/lib/raceDay";

export type IcalEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date | null;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  // e.g. "FREQ=WEEKLY" or "FREQ=WEEKLY;BYDAY=MO,TU"
  rrule?: string | null;
  // Occurrences to skip (same wall-clock time as `start`, other days).
  exdates?: Date[];
};

// "20261003T094000" in club time.
export function clubLocalStamp(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}${get("month")}${get("day")}T${get("hour")}${get("minute")}${get("second")}`;
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function escapeIcalText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

// Lines longer than 75 characters continue on the next line after a space.
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

// US Eastern rules since 2007.
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${CLUB_TIME_ZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:20070311T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:20071104T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function buildCalendar(name: string, events: IcalEvent[], now: Date = new Date()): string {
  const tz = `;TZID=${CLUB_TIME_ZONE}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BoathouseOS//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcalText(name)}`,
    `X-WR-TIMEZONE:${CLUB_TIME_ZONE}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART${tz}:${clubLocalStamp(e.start)}`,
      `DTEND${tz}:${clubLocalStamp(e.end ?? new Date(e.start.getTime() + 60 * 60 * 1000))}`,
      `SUMMARY:${escapeIcalText(e.title)}`
    );
    if (e.location) lines.push(`LOCATION:${escapeIcalText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcalText(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    if (e.exdates?.length) lines.push(`EXDATE${tz}:${e.exdates.map(clubLocalStamp).join(",")}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// The moment it's `hhmm` ("16:15") on `dateKey` ("2026-10-03") in club time.
export function clubDateTime(dateKey: string, hhmm: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  // How far club time is behind UTC at that moment (4 or 5 hours).
  const stamp = clubLocalStamp(new Date(guess));
  const shown = Date.UTC(
    Number(stamp.slice(0, 4)),
    Number(stamp.slice(4, 6)) - 1,
    Number(stamp.slice(6, 8)),
    Number(stamp.slice(9, 11)),
    Number(stamp.slice(11, 13))
  );
  return new Date(guess + (guess - shown));
}
