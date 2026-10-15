import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import { authApi } from '../api/auth'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { AuthLayout } from './AuthLayout'
import { mapServerError, validateEmail } from './authValidation'
import styles from './AuthLayout.module.css'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [formError, setFormError] = useState<string | null>(null)

  const request = useMutation({
    mutationFn: authApi.forgotPassword,
    onError: (err) => {
      const mapped = mapServerError(err, ['email'])
      setError(mapped.errors.email)
      setFormError(mapped.formError)
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    const emailError = validateEmail(email)
    setError(emailError)
    if (!emailError) request.mutate(email.trim())
  }

  const footer = (
    <>
      Remembered it? <Link to="/login">Log in</Link>
    </>
  )

  if (request.isSuccess) {
    return (
      <AuthLayout title="Check your email" subtitle={request.data.message} footer={footer}>
        <p>The link works once and expires in 30 minutes. If it doesn't arrive, check spam or try again.</p>
        {import.meta.env.DEV && (
          <p className={styles.hint}>
            Running locally, nothing is emailed. The link is in the API server's log.
          </p>
        )}
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={footer}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={error}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Button
          type="submit"
          variant="primary"
          block
          className={styles.submit}
          loading={request.isPending}
          loadingText="Sending…"
        >
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  )
}
