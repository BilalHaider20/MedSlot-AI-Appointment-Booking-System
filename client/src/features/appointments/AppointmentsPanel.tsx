import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { errorMessage } from '../../api/client'
import type { AppointmentScope } from '../../api/types'
import { useCurrentUser } from '../../auth/AuthProvider'
import { Button } from '../../components/Button'
import { TabPanel, Tabs } from '../../components/Tabs'
import { AppointmentRow, AppointmentRowSkeleton } from './AppointmentRow'
import { BookingDialog } from './BookingDialog'
import { useAppointments } from './queries'
import styles from './AppointmentsPanel.module.css'

const SCOPES: { id: AppointmentScope; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

export function AppointmentsPanel() {
  const [scope, setScope] = useState<AppointmentScope>('upcoming')
  const [formOpen, setFormOpen] = useState(false)

  return (
    <section className={styles.panel} aria-labelledby="appointments-title">
      <header className={styles.header}>
        <h2 id="appointments-title" className={styles.title}>
          Your appointments
        </h2>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <CalendarPlus size={15} aria-hidden />
          Book with the form
        </Button>
      </header>
      <Tabs idPrefix="appointments" label="Appointments" items={SCOPES} value={scope} onChange={setScope} />
      <TabPanel idPrefix="appointments" value={scope} className={styles.body}>
        <AppointmentList scope={scope} onBook={() => setFormOpen(true)} />
      </TabPanel>
      <BookingDialog open={formOpen} onClose={() => setFormOpen(false)} />
    </section>
  )
}

function AppointmentList({ scope, onBook }: { scope: AppointmentScope; onBook: () => void }) {
  const { business } = useCurrentUser()
  const { data, isPending, isError, error, refetch } = useAppointments(scope)

  if (isPending) {
    return (
      <ul className={styles.list} aria-busy="true" aria-label="Loading appointments">
        <AppointmentRowSkeleton />
        <AppointmentRowSkeleton />
        <AppointmentRowSkeleton />
      </ul>
    )
  }

  if (isError) {
    return (
      <div className={styles.state}>
        <p>{errorMessage(error)}</p>
        <Button size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (data.length === 0) {
    return scope === 'upcoming' ? (
      <div className={styles.state}>
        <p>No upcoming appointments. Ask the assistant or use the form.</p>
        <Button size="sm" variant="primary" onClick={onBook}>
          Book with the form
        </Button>
      </div>
    ) : (
      <div className={styles.state}>
        <p>No past appointments yet.</p>
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {data.map((appointment) => (
        <AppointmentRow
          key={appointment.id}
          appointment={appointment}
          timeZone={business.timezone}
          cancellable={scope === 'upcoming'}
        />
      ))}
    </ul>
  )
}
