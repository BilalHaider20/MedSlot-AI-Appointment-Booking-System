import styles from './TypingIndicator.module.css'

export function TypingIndicator() {
  return (
    <div className={styles.bubble}>
      <span className="visually-hidden">Assistant is typing</span>
      <span className={styles.dot} aria-hidden />
      <span className={styles.dot} aria-hidden />
      <span className={styles.dot} aria-hidden />
    </div>
  )
}
