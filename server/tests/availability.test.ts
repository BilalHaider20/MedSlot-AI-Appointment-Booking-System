import { describe, expect, it } from 'vitest';
import {
  appointmentRange,
  dayStatus,
  freeSlots,
  type OpeningHours,
} from '../src/modules/appointments/availability.js';

const hours: OpeningHours = {
  timezone: 'America/New_York',
  openTime: '09:00',
  closeTime: '17:00',
  openDays: [1, 2, 3, 4, 5, 6],
  slotMinutes: 30,
};

const friday = '2026-10-16';
const wednesdayNoonUtc = new Date('2026-10-14T12:00:00Z');
const at = (iso: string) => new Date(iso);

describe('dayStatus', () => {
  it('knows open, closed and past days in the business timezone', () => {
    expect(dayStatus(hours, friday, wednesdayNoonUtc)).toBe('open');
    expect(dayStatus(hours, '2026-10-18', wednesdayNoonUtc)).toBe('closed'); // Sunday
    expect(dayStatus(hours, '2026-10-13', wednesdayNoonUtc)).toBe('past');
  });

  it('uses the clinic date, not the UTC date', () => {
    // 02:00 UTC on the 15th is still the evening of the 14th in New York.
    expect(dayStatus(hours, '2026-10-14', at('2026-10-15T02:00:00Z'))).toBe('open');
  });
});

describe('freeSlots', () => {
  const slots = (durationMinutes: number, booked = [] as { startsAt: Date; endsAt: Date }[], now = wednesdayNoonUtc) =>
    freeSlots({ hours, date: friday, durationMinutes, booked, now });

  it('steps through the day and only offers starts that finish by closing', () => {
    const thirty = slots(30);
    expect(thirty).toHaveLength(16);
    expect(thirty[0]).toBe('09:00');
    expect(thirty.at(-1)).toBe('16:30');
    expect(slots(45).at(-1)).toBe('16:00');
    expect(slots(60).at(-1)).toBe('16:00');
  });

  it('returns nothing on a closed day', () => {
    expect(freeSlots({ hours, date: '2026-10-18', durationMinutes: 30, booked: [], now: wednesdayNoonUtc })).toEqual([]);
  });

  it('drops slots overlapping a booking, but not ones that only touch it', () => {
    // 10:00-10:45 New York time (EDT, UTC-4).
    const booked = [{ startsAt: at('2026-10-16T14:00:00Z'), endsAt: at('2026-10-16T14:45:00Z') }];
    const thirty = slots(30, booked);
    expect(thirty).toContain('09:30');
    expect(thirty).not.toContain('10:00');
    expect(thirty).not.toContain('10:30');
    expect(thirty).toContain('11:00');

    const sixty = slots(60, booked);
    expect(sixty).not.toContain('09:30');
    expect(sixty).toContain('09:00');
    expect(sixty).toContain('11:00');
  });

  it('drops slots that have already started', () => {
    const lunchtimeFriday = at('2026-10-16T17:10:00Z'); // 13:10 in New York
    expect(slots(30, [], lunchtimeFriday)[0]).toBe('13:30');
  });
});

describe('appointmentRange', () => {
  it('converts clinic time to UTC on both sides of the DST change', () => {
    expect(appointmentRange(hours.timezone, '2026-10-30', '09:00', 45).startsAt.toISOString()).toBe(
      '2026-10-30T13:00:00.000Z',
    );
    const afterDst = appointmentRange(hours.timezone, '2026-11-02', '09:00', 45);
    expect(afterDst.startsAt.toISOString()).toBe('2026-11-02T14:00:00.000Z');
    expect(afterDst.endsAt.toISOString()).toBe('2026-11-02T14:45:00.000Z');
  });
});
