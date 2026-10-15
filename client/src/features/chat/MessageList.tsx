import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import type { ChatMessage } from './chatState'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import styles from './MessageList.module.css'

interface MessageListProps {
  messages: ChatMessage[]
  timeZone: string
  typing: boolean
  onRetry: (key: string) => void
  renderUi: (message: ChatMessage) => ReactNode
}

const STICK_THRESHOLD_PX = 64

export function MessageList({ messages, timeZone, typing, onRetry, renderUi }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const lastMessage = messages.at(-1)

  function scrollToBottom() {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) scrollToBottom()
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (lastMessage?.role === 'user') stickToBottom.current = true
    if (stickToBottom.current) scrollToBottom()
  }, [lastMessage?.key, lastMessage?.role])

  function handleScroll() {
    const element = scrollRef.current
    if (!element) return
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    stickToBottom.current = distance < STICK_THRESHOLD_PX
  }

  return (
    <div ref={scrollRef} className={styles.scroller} onScroll={handleScroll}>
      <div ref={contentRef} className={styles.list} role="log" aria-live="polite" aria-label="Conversation">
        {messages.map((message, index) => {
          const next = messages[index + 1]
          const endsGroup = !next || next.role !== message.role
          return (
            <MessageBubble
              key={message.key}
              message={message}
              timeZone={timeZone}
              showTime={endsGroup}
              onRetry={() => onRetry(message.key)}
            >
              {message.role === 'assistant' && renderUi(message)}
            </MessageBubble>
          )
        })}
        {typing && <TypingIndicator />}
      </div>
    </div>
  )
}
