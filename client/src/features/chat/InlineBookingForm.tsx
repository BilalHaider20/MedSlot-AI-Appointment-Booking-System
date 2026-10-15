import { useState } from 'react'
import { CircleCheck } from 'lucide-react'
import type { Appointment, Draft } from '../../api/types'
import { useCurrentUser } from '../../auth/AuthProvider'
import { formatDate, formatTime } from '../../lib/format'
import { BookingForm } from '../appointments/BookingForm'
import styles from './ChatCard.module.css'

export function InlineBookingForm({ draft }: { draft: Partial<Draft> }) {
  const { business } = useCurrentUser()
  const [booked, setBooked] = useState<Appointment | null>(null)

  if (booked) {
    return (
      <p className={styles.success}>
        <CircleCheck size={16} aria-hidden />
        You're booked for {booked.service.name.toLowerCase()} on{' '}
        {formatDate(booked.startsAt, business.timezone)} at {formatTime(booked.startsAt, business.timezone)}.
      </p>
    )
  }

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>Book with the form</p>
      <BookingForm initial={draft} onBooked={setBooked} />
    </div>
  )
}
