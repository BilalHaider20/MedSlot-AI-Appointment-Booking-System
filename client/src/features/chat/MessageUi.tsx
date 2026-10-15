import { CircleCheck } from 'lucide-react'
import type { Ui } from '../../api/types'
import { ConfirmCard } from './ConfirmCard'
import { InlineBookingForm } from './InlineBookingForm'
import { ServiceChips, SlotChips } from './QuickPicks'
import styles from './MessageUi.module.css'

interface MessageUiProps {
  ui: Ui
  busy: boolean
  confirming: boolean
  onSend: (text: string) => void
  onConfirm: () => void
  onChange: () => void
}

export function MessageUi({ ui, busy, confirming, onSend, onConfirm, onChange }: MessageUiProps) {
  switch (ui.type) {
    case 'slots':
      return <SlotChips slots={ui.slots} disabled={busy} onPick={onSend} />
    case 'services':
      return <ServiceChips services={ui.services} disabled={busy} onPick={onSend} />
    case 'confirm':
      return (
        <ConfirmCard
          draft={ui.draft}
          confirming={confirming}
          disabled={busy}
          onConfirm={onConfirm}
          onChange={onChange}
        />
      )
    case 'form':
      return <InlineBookingForm draft={ui.draft} />
    case 'booked':
      return (
        <p className={styles.booked}>
          <CircleCheck size={16} aria-hidden />
          Booked. It's in your appointments.
        </p>
      )
  }
}
