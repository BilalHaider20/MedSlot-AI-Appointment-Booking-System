import type { TimeOfDay } from '../ai/ai.schemas.js';

export type Draft = {
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  notes?: string;
};

/** What the assistant is waiting for. */
export type Step = 'idle' | 'service' | 'date' | 'time' | 'confirm' | 'booked';

export type ChatState = {
  step: Step;
  draft: Partial<Draft>;
  /** Turns in a row where nothing was understood. Two means we offer the form. */
  misses: number;
  timeOfDay?: TimeOfDay;
};

export type Ui =
  | { type: 'slots'; date: string; serviceId: string; slots: string[] }
  | { type: 'services'; services: { id: string; name: string }[] }
  | { type: 'confirm'; draft: Draft }
  | { type: 'form'; draft: Partial<Draft>; reason: 'unclear' }
  | { type: 'booked'; appointmentId: string };

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageMeta = { ui?: Ui };

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  meta: MessageMeta;
  createdAt: string;
};

export type ChatSession = {
  id: string;
  title: string;
  status: 'open' | 'closed';
  state: ChatState;
};

export type ChatSessionSummary = {
  id: string;
  title: string;
  status: 'open' | 'closed';
  lastMessageAt: string;
};

export const emptyState = (): ChatState => ({ step: 'idle', draft: {}, misses: 0 });
