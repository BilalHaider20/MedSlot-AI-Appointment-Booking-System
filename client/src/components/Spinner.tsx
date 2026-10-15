import styles from './Spinner.module.css'

export function Spinner({ label }: { label?: string }) {
  return (
    <span
      className={styles.spinner}
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
    >
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  )
}

export function FullPageSpinner() {
  return (
    <div className={styles.fullPage}>
      <Spinner label="Loading" />
    </div>
  )
}
