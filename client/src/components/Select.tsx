import { useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { Field, describedBy } from './Field'
import styles from './Field.module.css'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: string
}

export function Select({ label, error, hint, id, children, ...rest }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  return (
    <Field id={selectId} label={label} error={error} hint={hint}>
      <div className={styles.selectWrap}>
        <select
          id={selectId}
          className={`${styles.control} ${styles.select}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(selectId, error, hint)}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown size={16} className={styles.chevron} aria-hidden />
      </div>
    </Field>
  )
}
