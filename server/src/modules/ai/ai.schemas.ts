import { z } from 'zod';
import { isValidDate } from '../../lib/time.js';

export const intents = [
  'book',
  'availability',
  'list_appointments',
  'cancel',
  'confirm',
  'deny',
  'smalltalk',
  'unknown',
] as const;
export type Intent = (typeof intents)[number];

export const timesOfDay = ['morning', 'afternoon', 'evening'] as const;
export type TimeOfDay = (typeof timesOfDay)[number];

export type Extraction = {
  intent: Intent;
  serviceName?: string;
  date?: string; // YYYY-MM-DD, business timezone
  time?: string; // HH:mm, 24h
  timeOfDay?: TimeOfDay;
  notes?: string;
  confidence: number;
};

// Models like to send null for "not mentioned"; treat it the same as absent.
const optional = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((value) => value ?? undefined);

export const extractionSchema = z.object({
  intent: z.enum(intents),
  serviceName: optional(z.string().trim().min(1).max(100)),
  date: optional(z.string().refine(isValidDate)),
  time: optional(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)),
  timeOfDay: optional(z.enum(timesOfDay)),
  notes: optional(z.string().trim().min(1).max(500)),
  confidence: z.number().min(0).max(1),
});

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type ExtractContext = {
  businessId: string;
  sessionId: string;
  /** Oldest first, ending with the user's latest message. */
  history: ChatTurn[];
  draft: { serviceName?: string; date?: string; time?: string };
  services: { name: string; durationMinutes: number }[];
  today: string;
  timezone: string;
};

export type ExtractResult = {
  extraction: Extraction;
  provider: 'mistral' | 'rules';
  /** True when Mistral was configured but failed and the rules extractor answered instead. */
  fellBack: boolean;
};
