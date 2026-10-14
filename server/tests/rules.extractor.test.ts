import { describe, expect, it } from 'vitest';
import type { Extraction } from '../src/modules/ai/ai.schemas.js';
import { extractWithRules } from '../src/modules/ai/rules.extractor.js';

// Thursday.
const today = '2026-10-15';
const services = [
  { name: 'Initial assessment' },
  { name: 'Follow-up physio' },
  { name: 'Sports massage' },
  { name: 'Deep tissue massage' },
];

const cases: [string, Partial<Extraction>][] = [
  ['Book a sports massage tomorrow at 2pm', { intent: 'book', serviceName: 'Sports massage', date: '2026-10-16', time: '14:00' }],
  ['I need a deep tissue massage on Friday', { intent: 'book', serviceName: 'Deep tissue massage', date: '2026-10-16' }],
  ['can I get a massage', { intent: 'book', serviceName: 'massage' }],
  ["It's my first visit, next tuesday morning?", { serviceName: 'Initial assessment', date: '2026-10-20', timeOfDay: 'morning' }],
  ['follow up the day after tomorrow at 3:30 pm', { serviceName: 'Follow-up physio', date: '2026-10-17', time: '15:30' }],
  ['how about 15:00', { intent: 'book', time: '15:00' }],
  ['noon on 12 May', { date: '2027-05-12', time: '12:00' }],
  ['2026-11-02 at 10am', { date: '2026-11-02', time: '10:00' }],
  ['thursday', { date: '2026-10-15' }],
  ['next thursday at 3', { date: '2026-10-22', time: '15:00' }],
  ['sports massage next friday at 9am', { date: '2026-10-23', time: '09:00' }],
  ['12/05 at half past 3', { date: undefined, time: '15:30' }],
  ['Yes please', { intent: 'confirm' }],
  ['sounds good, book it', { intent: 'confirm' }],
  ['no, I want to change something', { intent: 'deny' }],
  ['no, make it 4pm', { intent: 'book', time: '16:00' }],
  ['What have I booked?', { intent: 'list_appointments' }],
  ['I need to cancel my appointment', { intent: 'cancel' }],
  ["what's free on saturday afternoon", { intent: 'availability', date: '2026-10-17', timeOfDay: 'afternoon' }],
  ['Good morning', { intent: 'smalltalk', timeOfDay: undefined }],
  ['purple elephants', { intent: 'unknown' }],
];

describe('extractWithRules', () => {
  it.each(cases)('%s', (message, expected) => {
    const result = extractWithRules(message, { services, today });
    // Field by field, so `date: undefined` means "not extracted".
    for (const [field, value] of Object.entries(expected)) {
      expect(result[field as keyof Extraction], field).toEqual(value);
    }
  });

  it('leaves the service unset when nothing in the catalog matches', () => {
    expect(extractWithRules('a haircut tomorrow', { services, today }).serviceName).toBeUndefined();
  });
});
