// Pure slot maths. Everything is computed in the business timezone, so a 09:00
// opening is 09:00 at the clinic regardless of where the server runs.
import { DateTime } from 'luxon';
import { todayIn } from '../../lib/time.js';

export type OpeningHours = {
  timezone: string;
  openTime: string; // HH:mm
  closeTime: string; // HH:mm
  openDays: number[]; // ISO weekdays, 1 = Monday
  slotMinutes: number;
};

export type TimeRange = { startsAt: Date; endsAt: Date };

export type DayStatus = 'open' | 'closed' | 'past';

function atClinic(date: string, time: string, timezone: string): DateTime {
  return DateTime.fromISO(`${date}T${time}`, { zone: timezone });
}

function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function dayStatus(hours: OpeningHours, date: string, now: Date): DayStatus {
  // ISO dates compare correctly as strings.
  if (date < todayIn(hours.timezone, now)) return 'past';
  return hours.openDays.includes(DateTime.fromISO(date).weekday) ? 'open' : 'closed';
}

/** Whether a service of this length starting at `time` fits inside opening hours at all. */
export function fitsOpeningHours(hours: OpeningHours, time: string, durationMinutes: number): boolean {
  const start = minutesOf(time);
  return start >= minutesOf(hours.openTime) && start + durationMinutes <= minutesOf(hours.closeTime);
}

export function appointmentRange(timezone: string, date: string, time: string, durationMinutes: number): TimeRange {
  const start = atClinic(date, time, timezone);
  return { startsAt: start.toJSDate(), endsAt: start.plus({ minutes: durationMinutes }).toJSDate() };
}

/** Opening to closing time of one day, as UTC instants. */
export function openingRange(hours: OpeningHours, date: string): TimeRange {
  return {
    startsAt: atClinic(date, hours.openTime, hours.timezone).toJSDate(),
    endsAt: atClinic(date, hours.closeTime, hours.timezone).toJSDate(),
  };
}

const overlaps = (a: TimeRange, b: TimeRange) => a.startsAt < b.endsAt && b.startsAt < a.endsAt;

export function freeSlots(input: {
  hours: OpeningHours;
  date: string;
  durationMinutes: number;
  booked: TimeRange[];
  now: Date;
}): string[] {
  const { hours, date, durationMinutes, booked, now } = input;
  if (dayStatus(hours, date, now) !== 'open') return [];

  const close = atClinic(date, hours.closeTime, hours.timezone);
  const slots: string[] = [];

  for (
    let start = atClinic(date, hours.openTime, hours.timezone);
    start.plus({ minutes: durationMinutes }) <= close;
    start = start.plus({ minutes: hours.slotMinutes })
  ) {
    const candidate = { startsAt: start.toJSDate(), endsAt: start.plus({ minutes: durationMinutes }).toJSDate() };
    if (candidate.startsAt <= now) continue;
    if (booked.some((range) => overlaps(range, candidate))) continue;
    slots.push(start.toFormat('HH:mm'));
  }
  return slots;
}
