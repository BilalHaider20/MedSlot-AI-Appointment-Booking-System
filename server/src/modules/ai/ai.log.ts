import { query } from '../../db.js';
import { logger } from '../../lib/logger.js';
import type { Extraction } from './ai.schemas.js';

export type AiInteraction = {
  businessId: string;
  sessionId: string;
  provider: 'mistral' | 'rules';
  model: string | null;
  latencyMs: number;
  request: unknown;
  response?: unknown;
  parsed?: Extraction;
  error?: string;
};

/** Writes one row to ai_interactions and one log line. Never throws: logging must not break a chat turn. */
export async function logInteraction(entry: AiInteraction): Promise<void> {
  logger.info(
    {
      sessionId: entry.sessionId,
      provider: entry.provider,
      latencyMs: entry.latencyMs,
      intent: entry.parsed?.intent,
      error: entry.error,
    },
    'ai.extract',
  );

  try {
    await query(
      `INSERT INTO ai_interactions (business_id, session_id, provider, model, latency_ms, request, response, parsed, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.businessId,
        entry.sessionId,
        entry.provider,
        entry.model,
        Math.round(entry.latencyMs),
        JSON.stringify(entry.request),
        entry.response === undefined ? null : JSON.stringify(entry.response),
        entry.parsed === undefined ? null : JSON.stringify(entry.parsed),
        entry.error ?? null,
      ],
    );
  } catch (error) {
    logger.warn({ err: error }, 'could not write ai_interactions row');
  }
}
