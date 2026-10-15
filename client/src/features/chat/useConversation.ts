import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chatApi, type SessionWithMessages } from '../../api/chat'
import type { SessionSummary } from '../../api/types'

const CONVERSATION_KEY = ['chat', 'conversation'] as const

function mostRecent(sessions: SessionSummary[]) {
  return sessions
    .filter((session) => session.status === 'open')
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))[0]
}

async function openLatestConversation(): Promise<SessionWithMessages> {
  const latest = mostRecent(await chatApi.listSessions())
  return latest ? chatApi.messages(latest.id) : chatApi.createSession()
}

/**
 * Which conversation is open. Loaded once (latest open session, or a new one);
 * the messages themselves are then owned by useChat.
 */
export function useConversation() {
  const queryClient = useQueryClient()
  const conversation = useQuery({
    queryKey: CONVERSATION_KEY,
    queryFn: openLatestConversation,
    staleTime: Infinity,
  })

  const startNew = useMutation({
    mutationFn: chatApi.createSession,
    onSuccess: (created) => queryClient.setQueryData(CONVERSATION_KEY, created),
  })

  return { conversation, startNew }
}
