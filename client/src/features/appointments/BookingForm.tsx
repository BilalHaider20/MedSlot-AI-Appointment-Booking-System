import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { appointmentsApi } from '../../api/appointments'
import { errorMessage, isApiError } from '../../api/client'
import type { Appointment, Draft, Service } from '../../api/types'
import { useCurrentUser } from '../../auth/AuthProvider'
import { Button } from '../../components/Button'
import { Input, Textarea } from '../../components/Input'
import { Select } from '../../components/Select'
import { formatDuration, formatPrice, todayIn } from '../../lib/format'
import { SlotPicker } from './SlotPicker'
import { useAfterBooking, useAvailability, useServices } from './queries'
import styles from './BookingForm.module.css'

interface BookingFormProps {
  initial?: Partial<Draft>
  onBooked?: (appointment: Appointment) => void
}

const SLOT_TAKEN = 'That time was just taken. Pick another.'

function findServiceId(services: Service[] | undefined, name: string | undefined) {
  if (!services || !name) return ''
  const needle = name.toLowerCase()
  return services.find((service) => service.name.toLowerCase().includes(needle))?.id ?? ''
}

export function BookingForm({ initial, onBooked }: BookingFormProps) {
  const { business } = useCurrentUser()
  const today = todayIn(business.timezone)
  const services = useServices()

  const [chosenServiceId, setServiceId] = useState(initial?.serviceId ?? '')
  const [date, setDate] = useState(initial?.date && initial.date >= today ? initial.date : '')
  const [time, setTime] = useState(initial?.time ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const serviceId = chosenServiceId || findServiceId(services.data, initial?.serviceName)
  const availability = useAvailability(serviceId, date)
  const freeSlots = availability.data?.slots ?? []
  const selectedTime = freeSlots.includes(time) ? time : ''

  const afterBooking = useAfterBooking()
  const book = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: (appointment) => {
      afterBooking()
      onBooked?.(appointment)
    },
    onError: (err) => {
      if (isApiError(err) && err.status === 409) {
        setTime('')
        setError(SLOT_TAKEN)
        void availability.refetch()
      } else {
        setError(errorMessage(err))
      }
    },
  })

  const canSubmit = Boolean(serviceId && date >= today && selectedTime) && !book.isPending

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    book.mutate({ serviceId, date, time: selectedTime, notes: notes.trim() || undefined })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <Select
        label="Service"
        value={serviceId}
        disabled={services.isPending}
        error={services.isError ? errorMessage(services.error) : undefined}
        onChange={(event) => {
          setServiceId(event.target.value)
          setTime('')
          setError(null)
        }}
      >
        <option value="" disabled>
          {services.isPending ? 'Loading services…' : 'Choose a service'}
        </option>
        {services.data?.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name} · {formatDuration(service.durationMinutes)} · {formatPrice(service.priceCents)}
          </option>
        ))}
      </Select>

      <Input
        label="Date"
        type="date"
        min={today}
        value={date}
        onChange={(event) => {
          setDate(event.target.value)
          setTime('')
          setError(null)
        }}
      />

      <SlotPicker
        ready={Boolean(serviceId && date)}
        loading={availability.isFetching && !availability.data}
        error={availability.isError ? errorMessage(availability.error) : null}
        slots={freeSlots}
        value={selectedTime}
        onChange={(slot) => {
          setTime(slot)
          setError(null)
        }}
      />

      <Textarea
        label="Notes"
        optional
        rows={2}
        maxLength={500}
        placeholder="Anything we should know"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={!canSubmit}
        loading={book.isPending}
        loadingText="Booking…"
      >
        Book appointment
      </Button>
    </form>
  )
}
