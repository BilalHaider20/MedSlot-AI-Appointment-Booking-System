import { Dialog } from '../../components/Dialog'
import { BookingForm } from './BookingForm'

interface BookingDialogProps {
  open: boolean
  onClose: () => void
}

export function BookingDialog({ open, onClose }: BookingDialogProps) {
  return (
    <Dialog open={open} title="Book an appointment" onClose={onClose}>
      <BookingForm onBooked={onClose} />
    </Dialog>
  )
}
