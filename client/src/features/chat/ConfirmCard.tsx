import type { Draft } from '../../api/types'
import { Button } from '../../components/Button'
import { formatDay, formatDuration, formatPrice } from '../../lib/format'
import { useServices } from '../appointments/queries'
import styles from './ChatCard.module.css'

interface ConfirmCardProps {
  draft: Draft
  confirming: boolean
  disabled: boolean
  onConfirm: () => void
  onChange: () => void
}

function addMinutes(time: string, minutes: number) {
  const [hours, mins] = time.split(':').map(Number)
  const total = hours * 60 + mins + minutes
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`
}

export function ConfirmCard({ draft, confirming, disabled, onConfirm, onChange }: ConfirmCardProps) {
  const { data: services } = useServices()
  const service = services?.find((s) => s.id === draft.serviceId)

  return (
    <div className={styles.card}>
      <dl className={styles.details}>
        <dt>Service</dt>
        <dd>{draft.serviceName}</dd>
        <dt>Day</dt>
        <dd className="tabular">{formatDay(draft.date)}</dd>
        <dt>Time</dt>
        <dd className="tabular">
          {service ? `${draft.time}–${addMinutes(draft.time, service.durationMinutes)}` : draft.time}
        </dd>
        {service && (
          <>
            <dt>Duration</dt>
            <dd>{formatDuration(service.durationMinutes)}</dd>
            <dt>Price</dt>
            <dd className="tabular">{formatPrice(service.priceCents)}</dd>
          </>
        )}
        {draft.notes && (
          <>
            <dt>Notes</dt>
            <dd>{draft.notes}</dd>
          </>
        )}
      </dl>
      <div className={styles.actions}>
        <Button
          variant="primary"
          size="sm"
          loading={confirming}
          loadingText="Booking…"
          disabled={disabled}
          onClick={onConfirm}
        >
          Confirm booking
        </Button>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={onChange}>
          Change something
        </Button>
      </div>
    </div>
  )
}
