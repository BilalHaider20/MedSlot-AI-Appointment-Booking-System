import { Chip, ChipRow } from '../../components/Chip'

interface SlotChipsProps {
  slots: string[]
  disabled: boolean
  onPick: (time: string) => void
}

export function SlotChips({ slots, disabled, onPick }: SlotChipsProps) {
  return (
    <ChipRow label="Free times">
      {slots.map((slot) => (
        <Chip key={slot} disabled={disabled} onClick={() => onPick(slot)}>
          {slot}
        </Chip>
      ))}
    </ChipRow>
  )
}

interface ServiceChipsProps {
  services: { id: string; name: string }[]
  disabled: boolean
  onPick: (name: string) => void
}

export function ServiceChips({ services, disabled, onPick }: ServiceChipsProps) {
  return (
    <ChipRow label="Services">
      {services.map((service) => (
        <Chip key={service.id} disabled={disabled} onClick={() => onPick(service.name)}>
          {service.name}
        </Chip>
      ))}
    </ChipRow>
  )
}
