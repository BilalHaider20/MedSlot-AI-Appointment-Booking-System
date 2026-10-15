import { Chip } from '../../components/Chip'
import { Spinner } from '../../components/Spinner'
import styles from './BookingForm.module.css'

interface SlotPickerProps {
  ready: boolean
  loading: boolean
  error: string | null
  slots: string[]
  value: string
  onChange: (slot: string) => void
}

export function SlotPicker({ ready, loading, error, slots, value, onChange }: SlotPickerProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Time</legend>
      <SlotPickerBody
        ready={ready}
        loading={loading}
        error={error}
        slots={slots}
        value={value}
        onChange={onChange}
      />
    </fieldset>
  )
}

function SlotPickerBody({ ready, loading, error, slots, value, onChange }: SlotPickerProps) {
  if (!ready) return <p className={styles.muted}>Choose a service and a date to see free times.</p>
  if (loading) {
    return (
      <p className={styles.muted}>
        <Spinner /> Checking free times…
      </p>
    )
  }
  if (error) return <p className={styles.error}>{error}</p>
  if (slots.length === 0) return <p className={styles.muted}>No free times that day. Try another date.</p>

  return (
    <div className={styles.slots}>
      {slots.map((slot) => (
        <Chip key={slot} selected={slot === value} onClick={() => onChange(slot)}>
          {slot}
        </Chip>
      ))}
    </div>
  )
}
