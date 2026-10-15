import { api } from './client'
import type { Appointment, Message, Session, SessionSummary } from './types'

export interface SessionWithMessages {
  session: Session
  messages: Message[]
}

export interface ConfirmResult extends SessionWithMessages {
  /** null when the slot went between the confirm card and the click; the reply offers new times. */
  appointment: Appointment | null
}

export const chatApi = {
  listSessions: () => api.get<{ sessions: SessionSummary[] }>('/chat/sessions').then((r) => r.sessions),
  createSession: () => api.post<SessionWithMessages>('/chat/sessions'),
  messages: (sessionId: string, after?: string) => {
    const query = after ? `?after=${encodeURIComponent(after)}` : ''
    return api.get<SessionWithMessages>(`/chat/sessions/${sessionId}/messages${query}`)
  },
  send: (sessionId: string, content: string) =>
    api.post<SessionWithMessages>(`/chat/sessions/${sessionId}/messages`, { content }),
  confirm: (sessionId: string) => api.post<ConfirmResult>(`/chat/sessions/${sessionId}/confirm`),
}
