import { DateTime } from 'luxon';

const unitMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** "7d" -> milliseconds. Format is validated in config. */
export function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error(`Unsupported duration "${value}"`);
  return Number(match[1]) * unitMs[match[2] as keyof typeof unitMs];
}

export function todayIn(timezone: string, now: Date = new Date()): string {
  return DateTime.fromJSDate(now, { zone: timezone }).toISODate()!;
}

/** Calendar date at the business: "YYYY-MM-DD" for an instant. */
export function localDate(instant: Date, timezone: string): string {
  return DateTime.fromJSDate(instant, { zone: timezone }).toISODate()!;
}

/** Wall-clock time at the business: "HH:mm" for an instant. */
export function localTime(instant: Date, timezone: string): string {
  return DateTime.fromJSDate(instant, { zone: timezone }).toFormat('HH:mm');
}

/** "2026-10-17" -> "Sat 17 Oct", the short form used in replies and titles. */
export function dayLabel(date: string): string {
  return DateTime.fromISO(date).toFormat('ccc d LLL');
}

export function addDays(date: string, days: number): string {
  return DateTime.fromISO(date).plus({ days }).toISODate()!;
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && DateTime.fromISO(date).isValid;
}

export function isValidTimezone(timezone: string): boolean {
  return DateTime.local().setZone(timezone).isValid;
}
