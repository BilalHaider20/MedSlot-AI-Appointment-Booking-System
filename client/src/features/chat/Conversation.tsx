import { useRef } from 'react'
import type { SessionWithMessages } from '../../api/chat'
import { useCurrentUser } from '../../auth/AuthProvider'
import { Composer } from './Composer'
import { MessageList } from './MessageList'
import { MessageUi } from './MessageUi'
import { Suggestions } from './Suggestions'
import { useChat } from './useChat'
import styles from './Conversation.module.css'

export function Conversation({ conversation }: { conversation: SessionWithMessages }) {
  const { business } = useCurrentUser()
  const chat = useChat(conversation)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const latestAssistant = chat.messages.findLast((message) => message.role === 'assistant')
  const onlyGreeting =
    chat.messages.every((message) => message.role === 'assistant') && chat.messages.length <= 1

  return (
    <div className={styles.conversation}>
      <MessageList
        messages={chat.messages}
        timeZone={business.timezone}
        typing={chat.isSending || chat.isConfirming}
        onRetry={chat.retry}
        renderUi={(message) =>
          message.id === latestAssistant?.id && message.meta?.ui ? (
            <MessageUi
              ui={message.meta.ui}
              busy={chat.isBusy}
              confirming={chat.isConfirming}
              onSend={chat.send}
              onConfirm={chat.confirm}
              onChange={() => composerRef.current?.focus()}
            />
          ) : null
        }
      />
      <div className={styles.footer}>
        {onlyGreeting && <Suggestions disabled={chat.isBusy} onPick={chat.send} />}
        <Composer ref={composerRef} disabled={chat.isBusy} onSend={chat.send} />
      </div>
    </div>
  )
}
