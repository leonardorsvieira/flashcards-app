/** Local-time calendar helpers. Timestamps are epoch milliseconds. */

export const MINUTE_MS = 60 * 1000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

/** Start (00:00:00.000 local) of the day containing `ts`. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Last millisecond (23:59:59.999 local) of the day containing `ts`. */
export function endOfDay(ts: number): number {
  return addDays(startOfDay(ts), 1) - 1;
}

/** Adds calendar days in local time (DST-safe: keeps wall-clock time). */
export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Local calendar key, e.g. "2026-10-20". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Whole calendar days from `a` to `b` (positive when b is later). */
export function calendarDaysBetween(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
}
