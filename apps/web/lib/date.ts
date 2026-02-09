import { zonedTimeToUtc } from "date-fns-tz";

/** Default app timezone: Mountain (MST/MDT). */
export const DEFAULT_TIMEZONE = "America/Denver";

/** Start of today in the default timezone, as ISO string (for DB range queries). */
export function startOfTodayISO(): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-CA", { timeZone: DEFAULT_TIMEZONE }); // YYYY-MM-DD
  const start = zonedTimeToUtc(`${dateStr} 00:00:00`, DEFAULT_TIMEZONE);
  return start.toISOString();
}

/** Format a date for display in the default timezone. */
export function formatInDefaultTZ(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { ...options, timeZone: DEFAULT_TIMEZONE });
}

/** Format a date with time in the default timezone. */
export function formatDateTimeInDefaultTZ(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: DEFAULT_TIMEZONE,
  }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", { ...options, timeZone: DEFAULT_TIMEZONE });
}
