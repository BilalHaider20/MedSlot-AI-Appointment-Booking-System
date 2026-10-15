import type { ReactNode } from 'react'
import { formatTime } from '../../lib/format'
import type { ChatMessage } from './chatState'
import styles from './MessageBubble.module.css'

interface MessageBubbleProps {
  message: ChatMessage
  timeZone: string
  showTime: boolean
  onRetry: () => void
  children?: ReactNode
}

export function MessageBubble({ message, timeZone, showTime, onRetry, children }: MessageBubbleProps) {
  if (message.role === 'system') {
    return <p className={styles.system}>{message.content}</p>
  }

  const time = formatTime(message.createdAt, timeZone)
  const fromUser = message.role === 'user'

  return (
    <div
      className={[styles.message, fromUser ? styles.user : styles.assistant, children && styles.withExtra]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="visually-hidden">{fromUser ? 'You said:' : 'Assistant said:'}</span>
      <div className={styles.bubble} data-status={message.status} title={time}>
        {message.content}
      </div>
      {children && <div className={styles.extra}>{children}</div>}
      <MessageFooter status={message.status} time={showTime ? time : null} onRetry={onRetry} />
    </div>
  )
}

interface MessageFooterProps {
  status: ChatMessage['status']
  time: string | null
  onRetry: () => void
}

function MessageFooter({ status, time, onRetry }: MessageFooterProps) {
  if (status === 'failed') {
    return (
      <p className={`${styles.meta} ${styles.failed}`} role="alert">
        Not sent.{' '}
        <button type="button" className={styles.retry} onClick={onRetry}>
          Retry
        </button>
      </p>
    )
  }
  if (status === 'sending' || !time) return null
  return <p className={`${styles.meta} tabular`}>{time}</p>
}
