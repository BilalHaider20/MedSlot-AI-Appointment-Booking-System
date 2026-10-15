import { useCallback, useReducer, useState } from 'react'
import { chatApi, type SessionWithMessages } from '../../api/chat'
import { errorMessage, isApiError } from '../../api/client'
import { useToast } from '../../components/Toast'
import { useVisibleInterval } from '../../lib/useVisibleInterval'
import { useAfterBooking } from '../appointments/queries'
import { chatReducer, initChatState, isLocal, nextLocalKey } from './chatState'

const POLL_INTERVAL_MS = 4000

export function useChat(conversation: SessionWithMessages) {
  const sessionId = conversation.session.id
  const [{ messages }, dispatch] = useReducer(chatReducer, conversation.messages, initChatState)
  const [isConfirming, setIsConfirming] = useState(false)
  const afterBooking = useAfterBooking()
  const toast = useToast()

  const isSending = messages.some((message) => message.status === 'sending')
  const isBusy = isSending || isConfirming
  const lastSavedId = messages.findLast((message) => !isLocal(message))?.id

  const fetchNew = useCallback(async () => {
    const update = await chatApi.messages(sessionId, lastSavedId)
    dispatch({ type: 'received', messages: update.messages })
  }, [sessionId, lastSavedId])

  useVisibleInterval(fetchNew, POLL_INTERVAL_MS, !isBusy)

  const deliver = useCallback(
    async (key: string, content: string) => {
      try {
        const update = await chatApi.send(sessionId, content)
        dispatch({ type: 'sent', key, messages: update.messages })
      } catch {
        dispatch({ type: 'failed', key })
      }
    },
    [sessionId],
  )

  const send = useCallback(
    (text: string) => {
      const content = text.trim()
      if (!content || isBusy) return false
      const key = nextLocalKey()
      dispatch({ type: 'queued', key, content })
      void deliver(key, content)
      return true
    },
    [deliver, isBusy],
  )

  const retry = useCallback(
    (key: string) => {
      const message = messages.find((m) => m.key === key)
      if (!message || isBusy) return
      dispatch({ type: 'retrying', key })
      void deliver(key, message.content)
    },
    [deliver, isBusy, messages],
  )

  const confirm = useCallback(async () => {
    setIsConfirming(true)
    try {
      const result = await chatApi.confirm(sessionId)
      dispatch({ type: 'received', messages: result.messages })
      if (result.appointment) afterBooking()
    } catch (error) {
      const slotTaken = isApiError(error) && error.status === 409
      toast(slotTaken ? 'That time was just taken. Pick another.' : errorMessage(error), 'danger')
      void fetchNew().catch(() => undefined)
    } finally {
      setIsConfirming(false)
    }
  }, [afterBooking, fetchNew, sessionId, toast])

  return { messages, isSending, isConfirming, isBusy, send, retry, confirm }
}
