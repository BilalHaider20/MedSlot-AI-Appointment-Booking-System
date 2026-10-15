import type { Message } from '../../api/types'

export interface ChatMessage extends Message {
  /** Stable React key. Stays the same when an optimistic message is replaced by the saved one. */
  key: string
  status?: 'sending' | 'failed'
}

export interface ChatState {
  messages: ChatMessage[]
}

export type ChatAction =
  | { type: 'received'; messages: Message[] }
  | { type: 'queued'; key: string; content: string }
  | { type: 'sent'; key: string; messages: Message[] }
  | { type: 'failed'; key: string }
  | { type: 'retrying'; key: string }

const LOCAL_PREFIX = 'local-'
let localCounter = 0

export function nextLocalKey() {
  localCounter += 1
  return `${LOCAL_PREFIX}${Date.now()}-${localCounter}`
}

export function isLocal(message: ChatMessage) {
  return message.id.startsWith(LOCAL_PREFIX)
}

function byId(a: ChatMessage, b: ChatMessage) {
  const diff = BigInt(a.id) - BigInt(b.id)
  return diff === 0n ? 0 : diff < 0n ? -1 : 1
}

function toChatMessage(message: Message): ChatMessage {
  return { ...message, key: message.id }
}

export function initChatState(messages: Message[]): ChatState {
  return { messages: messages.map(toChatMessage).sort(byId) }
}

/** Adds messages we have not seen yet, keeps saved messages in id order and local ones last. */
function merge(existing: ChatMessage[], incoming: Message[]): ChatMessage[] {
  const known = new Set(existing.map((message) => message.id))
  const fresh = incoming.filter((message) => !known.has(message.id)).map(toChatMessage)
  if (fresh.length === 0) return existing

  const saved = [...existing.filter((message) => !isLocal(message)), ...fresh].sort(byId)
  return [...saved, ...existing.filter(isLocal)]
}

function setStatus(messages: ChatMessage[], key: string, status: ChatMessage['status']) {
  return messages.map((message) => (message.key === key ? { ...message, status } : message))
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'received':
      return { messages: merge(state.messages, action.messages) }

    case 'queued': {
      const message: ChatMessage = {
        id: action.key,
        key: action.key,
        role: 'user',
        content: action.content,
        meta: null,
        createdAt: new Date().toISOString(),
        status: 'sending',
      }
      return { messages: [...state.messages, message] }
    }

    case 'sent': {
      const savedUserId = action.messages.find((message) => message.role === 'user')?.id
      const withoutLocal = state.messages.filter((message) => message.key !== action.key)
      const messages = merge(withoutLocal, action.messages).map((message) =>
        message.id === savedUserId && message.key === message.id ? { ...message, key: action.key } : message,
      )
      return { messages }
    }

    case 'failed':
      return { messages: setStatus(state.messages, action.key, 'failed') }

    case 'retrying':
      return { messages: setStatus(state.messages, action.key, 'sending') }
  }
}
