import { useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { ArrowUp } from 'lucide-react'
import styles from './Composer.module.css'

interface ComposerProps {
  ref?: Ref<HTMLTextAreaElement>
  disabled: boolean
  onSend: (text: string) => boolean
}

const MAX_LENGTH = 1000

export function Composer({ ref, disabled, onSend }: ComposerProps) {
  const [text, setText] = useState('')
  const localRef = useRef<HTMLTextAreaElement>(null)
  const canSend = text.trim().length > 0 && !disabled

  useImperativeHandle(ref, () => localRef.current as HTMLTextAreaElement, [])

  useLayoutEffect(() => {
    const textarea = localRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [text])

  function submit() {
    if (canSend && onSend(text)) setText('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label htmlFor="composer" className="visually-hidden">
        Message
      </label>
      <textarea
        id="composer"
        ref={localRef}
        className={styles.input}
        rows={1}
        maxLength={MAX_LENGTH}
        placeholder="Ask for a time, like Thursday after 3"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button type="submit" className={styles.send} disabled={!canSend} aria-label="Send">
        <ArrowUp size={18} aria-hidden />
      </button>
    </form>
  )
}
