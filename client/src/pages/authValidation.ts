import { fieldErrors, isApiError } from '../api/client'

export type Errors<T extends string> = Partial<Record<T, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Enter your email.'
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email, like name@example.com.'
}

export function hasErrors<T extends string>(errors: Errors<T>) {
  return Object.values(errors).some(Boolean)
}

/** Splits a server error into field errors the form knows about, and a message for the rest. */
export function mapServerError<T extends string>(error: unknown, fields: readonly T[]) {
  const byField = fieldErrors(error)
  const errors: Errors<T> = {}
  for (const field of fields) {
    if (byField[field]) errors[field] = byField[field]
  }
  if (isApiError(error) && error.code === 'CONFLICT' && fields.includes('email' as T)) {
    errors['email' as T] = error.message
  }
  const formError = hasErrors(errors)
    ? null
    : isApiError(error)
      ? error.message
      : 'Something went wrong. Try again.'
  return { errors, formError }
}
