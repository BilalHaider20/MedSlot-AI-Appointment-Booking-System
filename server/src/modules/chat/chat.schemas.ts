import { z } from 'zod';
import { timesOfDay } from '../ai/ai.schemas.js';
import { emptyState, type ChatState } from './chat.types.js';

export const sessionParams = z.object({ id: z.uuid() });

export const messagesQuery = z.object({
  after: z
    .string()
    .regex(/^\d{1,18}$/, 'after must be a message id.')
    .optional(),
});

export const postMessageBody = z.object({
  content: z.string().trim().min(1, 'Type a message first.').max(1000, 'Keep messages under 1000 characters.'),
});

// state is our own jsonb, but parse it anyway so an old or hand-edited row can't crash a turn.
const draftSchema = z
  .object({
    serviceId: z.string(),
    serviceName: z.string(),
    date: z.string(),
    time: z.string(),
    notes: z.string(),
  })
  .partial();

export const chatStateSchema: z.ZodType<ChatState> = z.object({
  step: z.enum(['idle', 'service', 'date', 'time', 'confirm', 'booked']).catch('idle'),
  draft: draftSchema.catch({}),
  misses: z.number().int().min(0).catch(0),
  timeOfDay: z.enum(timesOfDay).optional().catch(undefined),
}).catch(emptyState);
