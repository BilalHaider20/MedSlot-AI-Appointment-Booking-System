import { useState } from 'react'
import type { Appointment, AppointmentStatus } from '../../api/types'
import { Badge, type BadgeTone } from '../../components/Badge'
import { Button } from '../../components/Button'
import { dateBlock, formatTimeRange } from '../../lib/format'
import { useCancelAppointment } from './queries'
import styles from './AppointmentRow.module.css'

const STATUS: Record<AppointmentStatus, { label: string; tone: BadgeTone }> = {
  booked: { label: 'Booked', tone: 'success' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

interface AppointmentRowProps {
  appointment: Appointment
  timeZone: string
  cancellable: boolean
}

export function AppointmentRow({ appointment, timeZone, cancellable }: AppointmentRowProps) {
  const [confirming, setConfirming] = useState(false)
  const cancel = useCancelAppointment()
  const day = dateBlock(appointment.startsAt, timeZone)
  const status = STATUS[appointment.status]
  const canCancel = cancellable && appointment.status === 'booked'

  return (
    <li className={styles.row}>
      <div className={styles.date} aria-hidden>
        <span className={styles.weekday}>{day.weekday}</span>
        <span className={styles.day}>{day.day}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.top}>
          <span className={styles.service}>{appointment.service.name}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className={styles.meta}>
          <span className="visually-hidden">{day.weekday} </span>
          <span className="tabular">
            {day.day} {day.month} · {formatTimeRange(appointment.startsAt, appointment.endsAt, timeZone)}
          </span>
        </p>

        {canCancel && !confirming && (
          <Button variant="ghost" size="sm" className={styles.cancel} onClick={() => setConfirming(true)}>
            Cancel
          </Button>
        )}
        {canCancel && confirming && (
          <div className={styles.confirm} role="group" aria-label="Cancel this appointment?">
            <span>Cancel this appointment?</span>
            <div className={styles.confirmActions}>
              <Button
                variant="danger-ghost"
                size="sm"
                loading={cancel.isPending}
                loadingText="Cancelling…"
                onClick={() => cancel.mutate(appointment.id, { onSettled: () => setConfirming(false) })}
              >
                Yes, cancel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={cancel.isPending}
                onClick={() => setConfirming(false)}
              >
                Keep it
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

export function AppointmentRowSkeleton() {
  return (
    <li className={styles.row} aria-hidden>
      <div className={`${styles.date} ${styles.skeleton}`} />
      <div className={styles.body}>
        <div className={`${styles.skeletonLine} ${styles.skeleton}`} />
        <div className={`${styles.skeletonLine} ${styles.short} ${styles.skeleton}`} />
      </div>
    </li>
  )
}
