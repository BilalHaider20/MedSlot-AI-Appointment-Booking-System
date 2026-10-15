import { describe, expect, it } from 'vitest';
import { calendarLines } from '../src/modules/ai/extract.js';

describe('calendarLines', () => {
  it('runs from today to the end of next week, labelled by week', () => {
    const lines = calendarLines('2026-10-15').split('\n'); // a Thursday

    expect(lines[0]).toBe('- Thursday 2026-10-15 (this week)');
    expect(lines).toContain('- Sunday 2026-10-18 (this week)');
    expect(lines).toContain('- Monday 2026-10-19 (next week)');
    expect(lines.at(-1)).toBe('- Sunday 2026-10-25 (next week)');
    expect(lines).toHaveLength(11);
  });
});
