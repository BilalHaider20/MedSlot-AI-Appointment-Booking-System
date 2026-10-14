import { withTransaction } from '../../db.js';
import { conflict, HttpError, notFound } from '../../lib/httpError.js';
import { addDays, dayLabel, todayIn } from '../../lib/time.js';
import { extract } from '../ai/extract.js';
import type { ChatTurn, ExtractResult } from '../ai/ai.schemas.js';
import {
  createAppointment,
  findNextFreeDay,
  getDayAvailability,
  listAppointments,
  type Appointment,
} from '../appointments/appointments.service.js';
import type { AuthUser } from '../auth/auth.tokens.js';
import { getBusiness, listServices, type Business, type Service } from '../services/services.service.js';
import {
  applyExtraction,
  completeDraft,
  isEmptyDraft,
  nextStep,
  stateAfter,
  understood,
  type Decision,
} from './chat.flow.js';
import * as replies from './chat.replies.js';
import * as repo from './chat.repository.js';
import { emptyState, type ChatMessage, type ChatSession, type ChatState, type Draft } from './chat.types.js';

const HISTORY_SIZE = 10;
const MAX_MISSES = 2;
const DEFAULT_TITLE = 'New conversation';

type TurnContext = {
  user: AuthUser;
  session: ChatSession;
  business: Business;
  services: Service[];
  today: string;
};

type Reply = replies.ReplyText & { state: ChatState; appointment?: Appointment };

async function getOwnSession(user: AuthUser, sessionId: string): Promise<ChatSession> {
  const session = await repo.findSession(user.businessId, user.id, sessionId);
  if (!session) throw notFound('Conversation not found.');
  return session;
}

async function loadContext(user: AuthUser, session: ChatSession): Promise<TurnContext> {
  const [business, services] = await Promise.all([getBusiness(user.businessId), listServices(user.businessId)]);
  return { user, session, business, services, today: todayIn(business.timezone) };
}

function titleFor(session: ChatSession, draft: Partial<Draft>): string {
  if (draft.serviceName && draft.date) return `${draft.serviceName} · ${dayLabel(draft.date)}`;
  return session.title || DEFAULT_TITLE;
}

async function saveReply(session: ChatSession, reply: Reply): Promise<{ message: ChatMessage; session: ChatSession }> {
  return withTransaction(async (client) => {
    const meta = reply.ui ? { ui: reply.ui } : {};
    const message = await repo.insertMessage(session.id, 'assistant', reply.content, meta, client);
    const updated = await repo.updateSession(
      session.id,
      { title: titleFor(session, reply.state.draft), state: reply.state },
      client,
    );
    return { message, session: updated };
  });
}

/** Loads what nextStep needs: the day's availability, and the next free day if that one is no good. */
async function decide(ctx: TurnContext, state: ChatState, ambiguous: Service[]): Promise<Decision> {
  const { draft } = state;
  const service = ctx.services.find((candidate) => candidate.id === draft.serviceId);
  const day = service && draft.date ? await getDayAvailability(ctx.business, service, draft.date) : null;

  let nextFreeDay = null;
  if (service && day && day.slots.length === 0) {
    const searchFrom = day.status === 'past' ? ctx.today : addDays(day.date, 1);
    nextFreeDay = await findNextFreeDay(ctx.business, service, searchFrom);
  }

  return nextStep({
    draft,
    services: ctx.services,
    ambiguous,
    hours: ctx.business,
    timeOfDay: state.timeOfDay,
    day,
    nextFreeDay,
  });
}

async function continueBooking(ctx: TurnContext, result: ExtractResult): Promise<Reply> {
  const { extraction, fellBack } = result;
  const misses = understood(extraction) ? 0 : ctx.session.state.misses + 1;
  const { state, ambiguous } = applyExtraction({ ...ctx.session.state, misses }, extraction, ctx.services);

  if (misses >= MAX_MISSES || (fellBack && !understood(extraction))) {
    return { ...replies.offerForm(state, 'unclear'), state: { ...state, misses: 0 } };
  }

  const decision = await decide(ctx, state, ambiguous);
  return { ...replies.forDecision(decision), state: stateAfter(state, decision) };
}

/** Books the confirmed draft. If the slot went in the meantime, offers what is still free. */
async function bookDraft(ctx: TurnContext): Promise<Reply> {
  const { state } = ctx.session;
  const draft = completeDraft(state.draft);
  if (state.step !== 'confirm' || !draft) throw conflict("There's nothing to confirm yet.");

  try {
    const appointment = await createAppointment(ctx.user, {
      serviceId: draft.serviceId,
      date: draft.date,
      time: draft.time,
      notes: draft.notes,
      source: 'chat',
      chatSessionId: ctx.session.id,
    });
    return { ...replies.booked(draft, appointment.id), state: { ...emptyState(), step: 'booked' }, appointment };
  } catch (error) {
    if (!(error instanceof HttpError && error.status === 409)) throw error;

    const service = ctx.services.find((candidate) => candidate.id === draft.serviceId);
    if (!service) throw error;
    const day = await getDayAvailability(ctx.business, service, draft.date);
    const { time, ...withoutTime } = draft;
    return {
      ...replies.justTaken(time, service, draft.date, day.slots),
      state: { ...state, draft: withoutTime, step: 'time' },
    };
  }
}

async function respond(ctx: TurnContext, result: ExtractResult): Promise<Reply> {
  const { state } = ctx.session;
  const awaitingConfirmation = state.step === 'confirm';

  switch (result.extraction.intent) {
    case 'list_appointments': {
      const appointments = await listAppointments(ctx.user, 'upcoming');
      return { ...replies.upcoming(appointments, ctx.business.timezone), state: { ...state, misses: 0 } };
    }
    case 'cancel':
      return { ...replies.cancelHint(), state: { ...state, misses: 0 } };
    case 'confirm':
      if (awaitingConfirmation) return bookDraft(ctx);
      break;
    case 'deny':
      // Leaving 'confirm' means a stray "yes" later can't book something by accident.
      if (awaitingConfirmation) return { ...replies.offerForm(state, 'change'), state: { ...state, step: 'idle' } };
      break;
    case 'smalltalk':
      if (isEmptyDraft(state.draft)) return { ...replies.smalltalk(ctx.services), state: { ...state, misses: 0 } };
      break;
  }
  return continueBooking(ctx, result);
}

function toHistory(messages: ChatMessage[]): ChatTurn[] {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role === 'user' ? 'user' : 'assistant', content: message.content }));
}

export function listSessions(user: AuthUser) {
  return repo.listSessions(user.businessId, user.id);
}

export async function createSession(user: AuthUser) {
  const [business, services] = await Promise.all([getBusiness(user.businessId), listServices(user.businessId)]);
  const hello = replies.greeting(business.name, services);

  return withTransaction(async (client) => {
    const session = await repo.insertSession(user.businessId, user.id, emptyState(), client);
    const message = await repo.insertMessage(session.id, 'assistant', hello.content, { ui: hello.ui }, client);
    return { session, messages: [message] };
  });
}

export async function getMessages(user: AuthUser, sessionId: string, afterId?: string) {
  const session = await getOwnSession(user, sessionId);
  return { messages: await repo.listMessages(session.id, afterId), session };
}

export async function postMessage(user: AuthUser, sessionId: string, content: string) {
  const session = await getOwnSession(user, sessionId);
  const userMessage = await repo.insertMessage(session.id, 'user', content);
  const ctx = await loadContext(user, session);
  const history = await repo.recentMessages(session.id, HISTORY_SIZE);

  // Not inside a transaction: the Mistral call can take seconds and shouldn't hold a connection.
  const result = await extract({
    businessId: user.businessId,
    sessionId: session.id,
    history: toHistory(history),
    draft: session.state.draft,
    services: ctx.services,
    today: ctx.today,
    timezone: ctx.business.timezone,
  });

  const reply = await respond(ctx, result);
  const saved = await saveReply(session, reply);
  return { messages: [userMessage, saved.message], session: saved.session };
}

export async function confirmBooking(user: AuthUser, sessionId: string) {
  const session = await getOwnSession(user, sessionId);
  const reply = await bookDraft(await loadContext(user, session));
  const saved = await saveReply(session, reply);
  return { messages: [saved.message], session: saved.session, appointment: reply.appointment ?? null };
}
