// The booking conversation as plain functions: fold what the user said into the
// draft, then decide what to ask next. No I/O here; chat.service.ts loads the data.
import type { Extraction, TimeOfDay } from '../ai/ai.schemas.js';
import { fitsOpeningHours, type OpeningHours } from '../appointments/availability.js';
import type { DayAvailability } from '../appointments/appointments.service.js';
import type { Service } from '../services/services.service.js';
import type { ChatState, Draft, Step } from './chat.types.js';

export type Decision =
  | { kind: 'askService'; options: Service[]; ambiguous: boolean }
  | { kind: 'askDate'; service: Service }
  | {
      kind: 'moveDay';
      reason: 'past' | 'closed' | 'full';
      requested: string;
      next: DayAvailability | null;
      service: Service;
    }
  | {
      kind: 'pickTime';
      day: DayAvailability;
      shown: string[];
      timeOfDay?: TimeOfDay;
      preferenceMissed: boolean;
      service: Service;
    }
  | {
      kind: 'timeUnavailable';
      reason: 'taken' | 'outsideHours';
      time: string;
      day: DayAvailability;
      service: Service;
      hours: OpeningHours;
    }
  | { kind: 'confirm'; draft: Draft; service: Service };

/** Case-insensitive contains match either way, so "deep tissue" and "Deep tissue massage session" both land. */
export function matchServices(services: Service[], name: string): Service[] {
  const needle = name.trim().toLowerCase();
  if (!needle) return [];
  return services.filter((service) => {
    const candidate = service.name.toLowerCase();
    return candidate.includes(needle) || needle.includes(candidate);
  });
}

/** Did the extractor get anything at all out of the message? */
export function understood(extraction: Extraction): boolean {
  const hasField = Boolean(extraction.serviceName || extraction.date || extraction.time || extraction.timeOfDay);
  return hasField || extraction.intent !== 'unknown';
}

export function completeDraft(draft: Partial<Draft>): Draft | null {
  const { serviceId, serviceName, date, time, notes } = draft;
  if (!serviceId || !serviceName || !date || !time) return null;
  return notes ? { serviceId, serviceName, date, time, notes } : { serviceId, serviceName, date, time };
}

export const isEmptyDraft = (draft: Partial<Draft>) => !draft.serviceId && !draft.date && !draft.time;

/**
 * Merges extracted fields into the draft. Unknown service names are dropped;
 * names matching several services come back as `ambiguous` so we can ask which one.
 */
export function applyExtraction(
  state: ChatState,
  extraction: Extraction,
  services: Service[],
): { state: ChatState; ambiguous: Service[] } {
  const draft = { ...state.draft };
  let ambiguous: Service[] = [];
  let timeOfDay = state.timeOfDay;

  if (extraction.serviceName) {
    const matches = matchServices(services, extraction.serviceName);
    if (matches.length === 1) {
      draft.serviceId = matches[0]!.id;
      draft.serviceName = matches[0]!.name;
    } else if (matches.length > 1) {
      ambiguous = matches;
    }
  }
  if (extraction.date) draft.date = extraction.date;
  if (extraction.notes) draft.notes = extraction.notes;

  if (extraction.time) {
    draft.time = extraction.time;
    timeOfDay = undefined;
  } else if (extraction.timeOfDay) {
    // "Afternoon instead" replaces whatever exact time we had.
    delete draft.time;
    timeOfDay = extraction.timeOfDay;
  }

  return { state: { ...state, draft, timeOfDay }, ambiguous };
}

const TIME_OF_DAY_RANGES: Record<TimeOfDay, [string, string]> = {
  morning: ['00:00', '12:00'],
  afternoon: ['12:00', '17:00'],
  evening: ['17:00', '24:00'],
};

export function slotsForTimeOfDay(slots: string[], timeOfDay: TimeOfDay | undefined): string[] {
  if (!timeOfDay) return slots;
  const [from, to] = TIME_OF_DAY_RANGES[timeOfDay];
  return slots.filter((slot) => slot >= from && slot < to);
}

export type StepInput = {
  draft: Partial<Draft>;
  services: Service[];
  ambiguous: Service[];
  hours: OpeningHours;
  timeOfDay?: TimeOfDay;
  /** Availability of draft.date, loaded once service and date are known. */
  day: DayAvailability | null;
  /** First free day after a past, closed or full one. */
  nextFreeDay: DayAvailability | null;
};

export function nextStep(input: StepInput): Decision {
  const { draft, services, ambiguous, day } = input;

  const service = services.find((candidate) => candidate.id === draft.serviceId);
  if (!service) {
    return ambiguous.length > 0
      ? { kind: 'askService', options: ambiguous, ambiguous: true }
      : { kind: 'askService', options: services, ambiguous: false };
  }

  if (!draft.date || !day) return { kind: 'askDate', service };

  if (day.slots.length === 0) {
    const reason = day.status === 'open' ? 'full' : day.status;
    return { kind: 'moveDay', reason, requested: draft.date, next: input.nextFreeDay, service };
  }

  if (!draft.time) {
    const preferred = slotsForTimeOfDay(day.slots, input.timeOfDay);
    return {
      kind: 'pickTime',
      day,
      shown: preferred.length > 0 ? preferred : day.slots,
      timeOfDay: input.timeOfDay,
      preferenceMissed: Boolean(input.timeOfDay) && preferred.length === 0,
      service,
    };
  }

  if (!day.slots.includes(draft.time)) {
    const reason = fitsOpeningHours(input.hours, draft.time, service.durationMinutes) ? 'taken' : 'outsideHours';
    return { kind: 'timeUnavailable', reason, time: draft.time, day, service, hours: input.hours };
  }

  return { kind: 'confirm', draft: completeDraft(draft)!, service };
}

const STEP_AFTER: Record<Decision['kind'], Step> = {
  askService: 'service',
  askDate: 'date',
  moveDay: 'time',
  pickTime: 'time',
  timeUnavailable: 'time',
  confirm: 'confirm',
};

/** The state to store once the decision's reply has been sent. */
export function stateAfter(state: ChatState, decision: Decision): ChatState {
  const draft = { ...state.draft };

  if (decision.kind === 'moveDay') {
    // We offer the next free day's slots, so that day becomes the draft's day.
    delete draft.time;
    if (decision.next) draft.date = decision.next.date;
    else delete draft.date;
  }
  if (decision.kind === 'timeUnavailable') delete draft.time;

  const step = decision.kind === 'moveDay' && !decision.next ? 'date' : STEP_AFTER[decision.kind];
  return { ...state, draft, step };
}
