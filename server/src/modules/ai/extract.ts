import { performance } from 'node:perf_hooks';
import { DateTime } from 'luxon';
import { config } from '../../config.js';
import { logInteraction } from './ai.log.js';
import { extractionSchema, type ExtractContext, type Extraction, type ExtractResult } from './ai.schemas.js';
import { completeJson, MistralError, type MistralMessage } from './mistral.client.js';
import { extractWithRules } from './rules.extractor.js';

const MAX_INPUT_CHARS = 1000;

const RESPONSE_SHAPE = `{
  "intent": "book" | "availability" | "list_appointments" | "cancel" | "confirm" | "deny" | "smalltalk" | "unknown",
  "serviceName": string | null,
  "date": "YYYY-MM-DD" | null,
  "time": "HH:mm" (24h) | null,
  "timeOfDay": "morning" | "afternoon" | "evening" | null,
  "notes": string | null,
  "confidence": number between 0 and 1
}`;

/**
 * Models are unreliable at weekday arithmetic, so we hand them a calendar to copy
 * from: today through the end of next week, labelled by week.
 */
export function calendarLines(todayIso: string): string {
  const today = DateTime.fromISO(todayIso);
  const lastDay = today.endOf('week').plus({ weeks: 1 });
  const lines: string[] = [];
  for (let day = today; day <= lastDay; day = day.plus({ days: 1 })) {
    const week = day.hasSame(today, 'week') ? 'this week' : 'next week';
    lines.push(`- ${day.toFormat('cccc')} ${day.toISODate()} (${week})`);
  }
  return lines.join('\n');
}

/**
 * Only facts we control go in here: catalog, date, and draft fields that were
 * already validated. User text is never interpolated (draft notes stay out too).
 */
export function buildSystemPrompt(context: ExtractContext): string {
  const today = DateTime.fromISO(context.today);
  const services = context.services.map((s) => `- ${s.name} (${s.durationMinutes} min)`).join('\n');
  const draft = JSON.stringify({
    serviceName: context.draft.serviceName ?? null,
    date: context.draft.date ?? null,
    time: context.draft.time ?? null,
  });

  return [
    'You read messages sent to a clinic booking assistant and extract booking details as JSON.',
    'You do not reply to the user and you never decide whether a time is free.',
    '',
    `Services:\n${services}`,
    `Today is ${today.toFormat('cccc')} ${context.today}. Timezone: ${context.timezone}.`,
    `Booking draft so far: ${draft}`,
    '',
    'Look at the latest user message, using earlier messages only for context.',
    `Calendar:\n${calendarLines(context.today)}`,
    'Copy dates from the calendar, never calculate them. A plain weekday ("friday") is the first one on or after today;',
    '"next friday" is the one marked next week. Dates further out: count from the calendar. Use null for anything not stated.',
    'serviceName must be one of the services above, or null if unclear.',
    'Use "confirm" for yes / sounds good / book it, and "deny" for no / change something.',
    'If the user changes the service, day or time, use "book" and return the new values.',
    'notes is only for things the clinic should know about the visit (symptoms, injuries, requests).',
    'Never put dates, times or scheduling changes in notes. Use null if there is nothing.',
    `Return only a JSON object with exactly this shape:\n${RESPONSE_SHAPE}`,
  ].join('\n');
}

function capped(text: string): string {
  return text.slice(0, MAX_INPUT_CHARS);
}

async function extractWithMistral(context: ExtractContext, apiKey: string): Promise<Extraction> {
  const messages: MistralMessage[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...context.history.map((turn) => ({ role: turn.role, content: capped(turn.content) })),
  ];
  const request = { model: config.MISTRAL_MODEL, messages };
  const started = performance.now();
  let response: unknown;

  try {
    const result = await completeJson({ apiKey, model: config.MISTRAL_MODEL, messages });
    response = result.body;
    const extraction: Extraction = extractionSchema.parse(JSON.parse(result.content));
    await logInteraction({
      ...logBase(context),
      provider: 'mistral',
      model: config.MISTRAL_MODEL,
      latencyMs: performance.now() - started,
      request,
      response,
      parsed: extraction,
    });
    return extraction;
  } catch (error) {
    await logInteraction({
      ...logBase(context),
      provider: 'mistral',
      model: config.MISTRAL_MODEL,
      latencyMs: performance.now() - started,
      request,
      response: response ?? (error instanceof MistralError ? error.responseBody : undefined),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function extractByRules(context: ExtractContext): Promise<Extraction> {
  const latest = capped(context.history.findLast((turn) => turn.role === 'user')?.content ?? '');
  const started = performance.now();
  const extraction = extractWithRules(latest, { services: context.services, today: context.today });
  await logInteraction({
    ...logBase(context),
    provider: 'rules',
    model: null,
    latencyMs: performance.now() - started,
    request: { text: latest, today: context.today },
    parsed: extraction,
  });
  return extraction;
}

const logBase = (context: ExtractContext) => ({ businessId: context.businessId, sessionId: context.sessionId });

/** Mistral when a key is configured, rules otherwise or whenever Mistral fails. */
export async function extract(context: ExtractContext): Promise<ExtractResult> {
  if (config.MISTRAL_API_KEY) {
    try {
      return { extraction: await extractWithMistral(context, config.MISTRAL_API_KEY), provider: 'mistral', fellBack: false };
    } catch {
      // Already recorded in ai_interactions; the rules extractor takes over.
      return { extraction: await extractByRules(context), provider: 'rules', fellBack: true };
    }
  }
  return { extraction: await extractByRules(context), provider: 'rules', fellBack: false };
}
