import { pool, query, type Queryable } from '../../db.js';
import { chatStateSchema } from './chat.schemas.js';
import type { ChatMessage, ChatSession, ChatSessionSummary, ChatState, MessageMeta, MessageRole } from './chat.types.js';

type SessionRow = {
  id: string;
  title: string;
  status: 'open' | 'closed';
  state: unknown;
  last_message_at: Date;
};

type MessageRow = {
  id: string; // bigint arrives as a string, which is what the API wants anyway
  role: MessageRole;
  content: string;
  meta: MessageMeta;
  created_at: Date;
};

const toSession = (row: SessionRow): ChatSession => ({
  id: row.id,
  title: row.title,
  status: row.status,
  state: chatStateSchema.parse(row.state),
});

const toSummary = (row: SessionRow): ChatSessionSummary => ({
  id: row.id,
  title: row.title,
  status: row.status,
  lastMessageAt: row.last_message_at.toISOString(),
});

const toMessage = (row: MessageRow): ChatMessage => ({
  id: row.id,
  role: row.role,
  content: row.content,
  meta: row.meta,
  createdAt: row.created_at.toISOString(),
});

const sessionColumns = 'id, title, status, state, last_message_at';
const messageColumns = 'id, role, content, meta, created_at';

export async function listSessions(businessId: string, userId: string): Promise<ChatSessionSummary[]> {
  const rows = await query<SessionRow>(
    `SELECT ${sessionColumns} FROM chat_sessions
     WHERE business_id = $1 AND user_id = $2
     ORDER BY last_message_at DESC
     LIMIT 50`,
    [businessId, userId],
  );
  return rows.map(toSummary);
}

export async function findSession(businessId: string, userId: string, id: string): Promise<ChatSession | null> {
  const rows = await query<SessionRow>(
    `SELECT ${sessionColumns} FROM chat_sessions WHERE business_id = $1 AND user_id = $2 AND id = $3`,
    [businessId, userId, id],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

export async function insertSession(
  businessId: string,
  userId: string,
  state: ChatState,
  db: Queryable = pool,
): Promise<ChatSession> {
  const rows = await query<SessionRow>(
    `INSERT INTO chat_sessions (business_id, user_id, state) VALUES ($1, $2, $3)
     RETURNING ${sessionColumns}`,
    [businessId, userId, JSON.stringify(state)],
    db,
  );
  return toSession(rows[0]!);
}

export async function updateSession(
  id: string,
  changes: { title: string; state: ChatState },
  db: Queryable = pool,
): Promise<ChatSession> {
  const rows = await query<SessionRow>(
    `UPDATE chat_sessions SET title = $2, state = $3, last_message_at = now()
     WHERE id = $1
     RETURNING ${sessionColumns}`,
    [id, changes.title, JSON.stringify(changes.state)],
    db,
  );
  return toSession(rows[0]!);
}

export async function insertMessage(
  sessionId: string,
  role: MessageRole,
  content: string,
  meta: MessageMeta = {},
  db: Queryable = pool,
): Promise<ChatMessage> {
  const rows = await query<MessageRow>(
    `INSERT INTO chat_messages (session_id, role, content, meta) VALUES ($1, $2, $3, $4)
     RETURNING ${messageColumns}`,
    [sessionId, role, content, JSON.stringify(meta)],
    db,
  );
  return toMessage(rows[0]!);
}

/** Messages after a cursor, oldest first. Without a cursor, the whole conversation (capped). */
export async function listMessages(sessionId: string, afterId?: string): Promise<ChatMessage[]> {
  const rows = await query<MessageRow>(
    `SELECT ${messageColumns} FROM chat_messages
     WHERE session_id = $1 AND id > $2
     ORDER BY id
     LIMIT 200`,
    [sessionId, afterId ?? '0'],
  );
  return rows.map(toMessage);
}

/** The last few messages, oldest first, for the extractor's context window. */
export async function recentMessages(sessionId: string, limit: number): Promise<ChatMessage[]> {
  const rows = await query<MessageRow>(
    `SELECT ${messageColumns} FROM chat_messages
     WHERE session_id = $1
     ORDER BY id DESC
     LIMIT $2`,
    [sessionId, limit],
  );
  return rows.map(toMessage).reverse();
}
