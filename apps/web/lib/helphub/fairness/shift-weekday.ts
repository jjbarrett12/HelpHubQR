import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TIMEZONE } from "@/lib/date";

/**
 * Weekday index (Sun=0 … Sat=6) for a calendar `shift_date` (YYYY-MM-DD) in the org schedule zone.
 * Aligns with shift scheduling / cron date interpretation (CRON_SCHEDULE_TZ or app default).
 */
export function orgWeekdayFromShiftDate(shiftDate: string): number {
  const tz = process.env.CRON_SCHEDULE_TZ?.trim() || DEFAULT_TIMEZONE;
  const parts = shiftDate.split("-").map((v) => parseInt(v, 10));
  const [y, m, d] = parts;
  if (!y || !m || !d) return 0;
  const inst = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  try {
    const e = formatInTimeZone(inst, tz, "e");
    return parseInt(e, 10);
  } catch {
    return inst.getUTCDay();
  }
}

/** Calendar `shift_date` minus N days as YYYY-MM-DD (UTC calendar math on the date parts). */
export function shiftDateLookbackFrom(shiftDateYmd: string, lookbackDays: number): string {
  const parts = shiftDateYmd.split("-").map((x) => parseInt(x, 10));
  const [y, mo, d] = parts;
  if (!y || !mo || !d) return shiftDateYmd;
  const u = new Date(Date.UTC(y, mo - 1, d));
  u.setUTCDate(u.getUTCDate() - lookbackDays);
  return u.toISOString().slice(0, 10);
}
