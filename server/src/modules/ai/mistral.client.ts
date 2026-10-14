import { z } from 'zod';

const ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const TIMEOUT_MS = 8_000;

export type MistralMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const completionSchema = z.object({
  model: z.string().optional(),
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

export class MistralError extends Error {
  constructor(
    message: string,
    readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'MistralError';
  }
}

/** One JSON-mode completion. Returns the raw message content and the full response body. */
export async function completeJson(options: {
  apiKey: string;
  model: string;
  messages: MistralMessage[];
}): Promise<{ content: string; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.apiKey}` },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new MistralError(`Mistral responded ${response.status}`, body);

    const parsed = completionSchema.safeParse(body);
    if (!parsed.success) throw new MistralError('Unexpected Mistral response shape', body);
    return { content: parsed.data.choices[0]!.message.content, body };
  } catch (error) {
    if (controller.signal.aborted) throw new MistralError(`Mistral timed out after ${TIMEOUT_MS} ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
