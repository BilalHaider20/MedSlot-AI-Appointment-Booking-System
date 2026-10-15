import { Chip, ChipRow } from '../../components/Chip'

const SUGGESTIONS = [
  'Book a sports massage tomorrow afternoon',
  "What's free on Friday?",
  'Show my appointments',
]

export function Suggestions({ disabled, onPick }: { disabled: boolean; onPick: (text: string) => void }) {
  return (
    <ChipRow label="Suggestions">
      {SUGGESTIONS.map((text) => (
        <Chip key={text} disabled={disabled} onClick={() => onPick(text)}>
          {text}
        </Chip>
      ))}
    </ChipRow>
  )
}
