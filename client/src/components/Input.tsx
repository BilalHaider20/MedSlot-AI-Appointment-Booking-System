import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Field, describedBy } from './Field'
import styles from './Field.module.css'

interface FieldProps {
  label: string
  error?: string
  hint?: string
  optional?: boolean
}

type InputProps = FieldProps & InputHTMLAttributes<HTMLInputElement>

export function Input({ label, error, hint, optional, id, className, ...rest }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <Field id={inputId} label={label} error={error} hint={hint} optional={optional}>
      <input
        id={inputId}
        className={[styles.control, className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        {...rest}
      />
    </Field>
  )
}

type TextareaProps = FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ label, error, hint, optional, id, ...rest }: TextareaProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <Field id={inputId} label={label} error={error} hint={hint} optional={optional}>
      <textarea
        id={inputId}
        className={`${styles.control} ${styles.textarea}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        {...rest}
      />
    </Field>
  )
}
