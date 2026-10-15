import { Plus } from 'lucide-react'
import { errorMessage } from '../../api/client'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'
import { useToast } from '../../components/Toast'
import { Conversation } from './Conversation'
import { useConversation } from './useConversation'
import styles from './ChatPanel.module.css'

export function ChatPanel() {
  const { conversation, startNew } = useConversation()
  const toast = useToast()

  return (
    <section className={styles.panel} aria-labelledby="chat-title">
      <header className={styles.header}>
        <div>
          <h2 id="chat-title" className={styles.title}>
            Book by chat
          </h2>
          <p className={styles.subtitle}>
            Say what you need and when. You confirm before anything is booked.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          loading={startNew.isPending}
          loadingText="Starting…"
          disabled={conversation.isPending}
          onClick={() =>
            startNew.mutate(undefined, { onError: (error) => toast(errorMessage(error), 'danger') })
          }
        >
          <Plus size={15} aria-hidden />
          New conversation
        </Button>
      </header>

      {conversation.isPending && (
        <div className={styles.state}>
          <Spinner label="Loading conversation" />
        </div>
      )}
      {conversation.isError && (
        <div className={styles.state}>
          <p>We couldn't load your conversation. {errorMessage(conversation.error)}</p>
          <Button size="sm" onClick={() => void conversation.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {conversation.data && (
        <Conversation key={conversation.data.session.id} conversation={conversation.data} />
      )}
    </section>
  )
}
