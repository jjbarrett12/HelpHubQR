import { fromZonedTime } from "date-fns-tz/fromZonedTime";

/** Default app timezone: Mountain (MST/MDT). */
export const DEFAULT_TIMEZONE = "America/Denver";

/** YYYY-MM-DD calendar date in a given IANA zone (matches Postgres `date` / shift_date). */
export function calendarDateInTimeZone(timeZone: string, instant: Date = new Date()): string {
  const tz = timeZone?.trim() || DEFAULT_TIMEZONE;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  }
}

/** Start of today in the default timezone, as ISO string (for DB range queries). */
export function startOfTodayISO(): string {
  return startOfTodayISOInTimeZone(DEFAULT_TIMEZONE);
}

/** Start of “today” in a specific IANA timezone (falls back to default if invalid). */
export function startOfTodayISOInTimeZone(timeZone: string): string {
  const tz = timeZone?.trim() || DEFAULT_TIMEZONE;
  try {
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-CA", { timeZone: tz });
    const start = fromZonedTime(`${dateStr}T00:00:00`, tz);
    return start.toISOString();
  } catch {
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-CA", { timeZone: DEFAULT_TIMEZONE });
    const start = fromZonedTime(`${dateStr}T00:00:00`, DEFAULT_TIMEZONE);
    return start.toISOString();
  }
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
