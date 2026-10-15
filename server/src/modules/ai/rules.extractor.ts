// Keyword and regex extractor. Runs when there is no Mistral key, and as the
// fallback when Mistral fails. It only reads the latest user message.
import { DateTime } from 'luxon';
import type { Extraction, Intent, TimeOfDay } from './ai.schemas.js';

type RulesContext = {
  services: { name: string }[];
  /** YYYY-MM-DD in the business timezone. */
  today: string;
};

const WEEKDAYS: Record<string, number> = {
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
  sun: 7, sunday: 7,
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Phrases people use for a service, mapped to text we look for in the catalog.
const SERVICE_HINTS: [RegExp, string][] = [
  [/\bsports?\s+massage\b/, 'sports massage'],
  [/\bdeep[\s-]?tissue\b/, 'deep tissue'],
  [/\bfollow[\s-]?up\b/, 'follow-up'],
  [/\bassessment\b|\bfirst (visit|appointment|session|time)\b|\bnew patient\b/, 'assessment'],
  [/\bmassage\b/, 'massage'],
];

// Order matters: "cancel my appointment" is a cancel, not a listing.
const INTENT_PATTERNS: [Intent, RegExp][] = [
  ['cancel', /\bcancel/],
  ['list_appointments', /\b(my (appointments?|bookings?)|what (have|did) i (book|booked)|what(?: have|'ve) i got(?: booked)?|what'?s booked|upcoming (appointments?|bookings?))\b/],
  ['availability', /\b(what'?s (free|available|open)|what is (free|available|open)|availability|available|free (slots?|times?)|any (slots?|times?|openings?)|openings?|what times)\b/],
];

const GREETING = /^(hi|hello|hey|hiya|good (morning|afternoon|evening)|thanks|thank you|cheers)( there)?[\s!.,]*$/;
const CONFIRM = /^(yes|yeah|yep|yup|sure|ok|okay|confirm|correct|perfect|great|please do|do it)\b|\b(sounds good|that works|book it|go ahead|confirm)\b/;
const DENY = /^(no|nope|nah|not quite|wait)\b|\b(change|something else|different)\b/;
const BOOK = /\b(book|appointment|schedule|reserve|come in)\b/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}

function findServiceName(text: string, services: { name: string }[]): string | undefined {
  const named = services.find((service) => text.includes(service.name.toLowerCase()));
  if (named) return named.name;

  for (const [pattern, hint] of SERVICE_HINTS) {
    if (!pattern.test(text)) continue;
    const matches = services.filter((service) => service.name.toLowerCase().includes(hint));
    if (matches.length === 1) return matches[0]!.name;
    // Several matches ("massage"): pass the word on so the chat can ask which one.
    return matches.length > 1 ? hint : undefined;
  }
  return undefined;
}

/**
 * "friday" is the coming Friday (today if it is Friday). "next friday" means the
 * one in next week, so on a Thursday it skips tomorrow; "next tuesday" on a
 * Thursday is five days away.
 */
function resolveWeekday(today: DateTime, weekday: number, saidNext: boolean): DateTime {
  let days = (weekday - today.weekday + 7) % 7;
  if (!saidNext) return today.plus({ days });
  if (days === 0) days = 7;
  const candidate = today.plus({ days });
  return candidate.hasSame(today, 'week') ? candidate.plus({ days: 7 }) : candidate;
}

function findDate(text: string, todayIso: string): string | undefined {
  const today = DateTime.fromISO(todayIso);

  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text);
  if (iso && DateTime.fromISO(iso[1]!).isValid) return iso[1];

  if (/\bday after tomorrow\b/.test(text)) return today.plus({ days: 2 }).toISODate()!;
  if (/\b(tomorrow|tmrw|tmr)\b/.test(text)) return today.plus({ days: 1 }).toISODate()!;
  if (/\b(today|tonight)\b/.test(text)) return todayIso;

  // "12 May", "12th of May", "12 May 2027". "May 12" and "12/05" are left alone on purpose:
  // the first collides with "may I", the second means different things on each side of the Atlantic.
  const dayMonth = /\b(\d{1,2})(?:st|nd|rd|th)?(?: of)? (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b(?: (\d{4}))?/.exec(text);
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const month = MONTHS[dayMonth[2]!]!;
    const explicitYear = dayMonth[3] ? Number(dayMonth[3]) : undefined;
    let date = DateTime.fromObject({ year: explicitYear ?? today.year, month, day });
    if (!explicitYear && date.isValid && date < today) date = date.plus({ years: 1 });
    if (date.isValid) return date.toISODate()!;
  }

  const weekday = /\b(next |this |on )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\b/.exec(text);
  if (weekday) {
    return resolveWeekday(today, WEEKDAYS[weekday[2]!]!, weekday[1] === 'next ').toISODate()!;
  }
  return undefined;
}

const pad = (value: number) => String(value).padStart(2, '0');
const formatTime = (hours: number, minutes: number) => `${pad(hours)}:${pad(minutes)}`;

// "at 3" or "half past 3" during clinic hours almost always means the afternoon.
const assumeDaytime = (hour: number) => (hour >= 1 && hour <= 7 ? hour + 12 : hour);

function findTime(text: string): string | undefined {
  if (/\b(noon|midday)\b/.test(text)) return '12:00';

  const twelveHour = /\b(\d{1,2})(?:[:.](\d{2}))? ?(am|pm|a\.m\.?|p\.m\.?)(?![a-z])/.exec(text);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2] ?? 0);
    if (hours < 1 || hours > 12 || minutes > 59) return undefined;
    const isPm = twelveHour[3]!.startsWith('p');
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
    return formatTime(hours, minutes);
  }

  const twentyFourHour = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
  if (twentyFourHour) {
    const [, hour, minutes] = twentyFourHour;
    // "3:30" with no am/pm is the afternoon; a written "03:30" is taken literally.
    const hours = hour!.length === 1 ? assumeDaytime(Number(hour)) : Number(hour);
    return formatTime(hours, Number(minutes));
  }

  const halfPast = /\bhalf past (\d{1,2})\b/.exec(text);
  if (halfPast) return formatTime(assumeDaytime(Number(halfPast[1])), 30);

  const quarterPast = /\bquarter past (\d{1,2})\b/.exec(text);
  if (quarterPast) return formatTime(assumeDaytime(Number(quarterPast[1])), 15);

  const atHour = /\b(?:at|around|about) (\d{1,2})\b(?![:.]\d)/.exec(text);
  if (atHour && Number(atHour[1]) <= 12) return formatTime(assumeDaytime(Number(atHour[1])), 0);

  return undefined;
}

function findTimeOfDay(text: string): TimeOfDay | undefined {
  if (/\bmorning\b/.test(text)) return 'morning';
  if (/\bafternoon\b/.test(text)) return 'afternoon';
  if (/\b(evening|after work)\b/.test(text)) return 'evening';
  return undefined;
}

function pickIntent(text: string, hasFields: boolean): { intent: Intent; confidence: number } {
  for (const [intent, pattern] of INTENT_PATTERNS) {
    if (pattern.test(text)) return { intent, confidence: 0.8 };
  }
  // "No, make it 4pm" is a change, so new details win over yes/no words.
  if (hasFields) return { intent: 'book', confidence: 0.7 };
  if (CONFIRM.test(text)) return { intent: 'confirm', confidence: 0.8 };
  if (DENY.test(text)) return { intent: 'deny', confidence: 0.7 };
  if (BOOK.test(text)) return { intent: 'book', confidence: 0.6 };
  return { intent: 'unknown', confidence: 0.2 };
}

export function extractWithRules(message: string, context: RulesContext): Extraction {
  const text = normalize(message);
  if (GREETING.test(text)) return { intent: 'smalltalk', confidence: 0.9 };

  const fields = {
    serviceName: findServiceName(text, context.services),
    date: findDate(text, context.today),
    time: findTime(text),
    timeOfDay: findTimeOfDay(text),
  };
  const hasFields = Object.values(fields).some((value) => value !== undefined);

  return { ...pickIntent(text, hasFields), ...fields };
}
