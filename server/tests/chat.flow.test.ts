import { describe, expect, it } from 'vitest';
import type { OpeningHours } from '../src/modules/appointments/availability.js';
import { applyExtraction, changesDraft, nextStep, stateAfter, type StepInput } from '../src/modules/chat/chat.flow.js';
import { emptyState } from '../src/modules/chat/chat.types.js';

const services = [
  { id: 's-sports', name: 'Sports massage', durationMinutes: 45, priceCents: 7500 },
  { id: 's-deep', name: 'Deep tissue massage', durationMinutes: 60, priceCents: 8500 },
  { id: 's-follow', name: 'Follow-up physio', durationMinutes: 30, priceCents: 6000 },
];
const hours: OpeningHours = {
  timezone: 'America/New_York',
  openTime: '09:00',
  closeTime: '17:00',
  openDays: [1, 2, 3, 4, 5, 6],
  slotMinutes: 30,
};
const base: StepInput = { draft: {}, services, ambiguous: [], hours, day: null, nextFreeDay: null };
const friday = { date: '2026-10-16', status: 'open' as const, slots: ['09:00', '09:30', '14:00', '14:30'] };

describe('applyExtraction', () => {
  it('maps a loose service name onto the catalog', () => {
    const { state } = applyExtraction(emptyState(), { intent: 'book', serviceName: 'deep tissue', confidence: 1 }, services);
    expect(state.draft).toMatchObject({ serviceId: 's-deep', serviceName: 'Deep tissue massage' });
  });

  it('keeps an ambiguous name out of the draft', () => {
    const result = applyExtraction(emptyState(), { intent: 'book', serviceName: 'massage', confidence: 1 }, services);
    expect(result.state.draft.serviceId).toBeUndefined();
    expect(result.ambiguous.map((s) => s.id)).toEqual(['s-sports', 's-deep']);
  });
});

describe('changesDraft', () => {
  const draft = { serviceId: 's-follow', serviceName: 'Follow-up physio', date: '2026-10-19', time: '11:00' };

  it('spots a new day, time or service', () => {
    expect(changesDraft(draft, { intent: 'deny', date: '2026-10-20', confidence: 1 }, services)).toBe(true);
    expect(changesDraft(draft, { intent: 'confirm', time: '16:00', confidence: 1 }, services)).toBe(true);
    expect(changesDraft(draft, { intent: 'book', serviceName: 'sports massage', confidence: 1 }, services)).toBe(true);
  });

  it('treats a plain yes, even one repeating the draft, as no change', () => {
    expect(changesDraft(draft, { intent: 'confirm', confidence: 1 }, services)).toBe(false);
    const repeated = { intent: 'confirm' as const, serviceName: 'Follow-up physio', date: '2026-10-19', time: '11:00', confidence: 1 };
    expect(changesDraft(draft, repeated, services)).toBe(false);
  });
});

describe('nextStep', () => {
  it('asks for what is missing, in order', () => {
    expect(nextStep(base).kind).toBe('askService');
    expect(nextStep({ ...base, draft: { serviceId: 's-sports' } }).kind).toBe('askDate');
  });

  it('lists slots, narrowed to the preferred part of the day', () => {
    const decision = nextStep({ ...base, draft: { serviceId: 's-sports', date: friday.date }, day: friday, timeOfDay: 'afternoon' });
    expect(decision).toMatchObject({ kind: 'pickTime', shown: ['14:00', '14:30'], preferenceMissed: false });
  });

  it('tells a taken time apart from one outside opening hours', () => {
    const draft = { serviceId: 's-sports', serviceName: 'Sports massage', date: friday.date };
    expect(nextStep({ ...base, draft: { ...draft, time: '10:00' }, day: friday })).toMatchObject({ reason: 'taken' });
    expect(nextStep({ ...base, draft: { ...draft, time: '16:30' }, day: friday })).toMatchObject({ reason: 'outsideHours' });
  });

  it('moves a closed day to the next free one', () => {
    const sunday = { date: '2026-10-18', status: 'closed' as const, slots: [] };
    const monday = { date: '2026-10-19', status: 'open' as const, slots: ['09:00'] };
    const draft = { serviceId: 's-sports', serviceName: 'Sports massage', date: sunday.date, time: '15:00' };
    const decision = nextStep({ ...base, draft, day: sunday, nextFreeDay: monday });
    expect(decision).toMatchObject({ kind: 'moveDay', reason: 'closed' });
    expect(stateAfter({ ...emptyState(), draft }, decision).draft).toEqual({
      serviceId: 's-sports',
      serviceName: 'Sports massage',
      date: '2026-10-19',
    });
  });

  it('confirms once everything checks out', () => {
    const draft = { serviceId: 's-sports', serviceName: 'Sports massage', date: friday.date, time: '14:00' };
    expect(nextStep({ ...base, draft, day: friday }).kind).toBe('confirm');
  });
});
