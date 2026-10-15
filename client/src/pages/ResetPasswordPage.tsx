import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { authApi } from '../api/auth'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { AuthLayout } from './AuthLayout'
import { hasErrors, mapServerError, validateNewPassword, type Errors } from './authValidation'
import styles from './AuthLayout.module.css'

type Field = 'password' | 'confirm'

function validate(password: string, confirm: string): Errors<Field> {
  return {
    password: validateNewPassword(password),
    confirm: confirm === password ? undefined : "The passwords don't match.",
  }
}

export function ResetPasswordPage() {
  const token = useSearchParams()[0].get('token')
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const reset = useMutation({
    mutationFn: (newPassword: string) => authApi.resetPassword(token ?? '', newPassword),
    onSuccess: () => {
      navigate('/login', {
        replace: true,
        state: { notice: 'Your password has been changed. Log in with the new one.' },
      })
    },
    onError: (error) => {
      const mapped = mapServerError(error, ['password'] as const)
      setErrors(mapped.errors)
      setFormError(mapped.formError)
    },
  })

  const footer = (
    <>
      Link not working? <Link to="/forgot-password">Ask for a new one</Link>
    </>
  )

  if (!token) {
    return (
      <AuthLayout
        title="This link is incomplete"
        subtitle="Open the link from the email again, or ask for a new one."
        footer={footer}
      >
        {null}
      </AuthLayout>
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validate(password, confirm)
    setErrors(nextErrors)
    if (!hasErrors(nextErrors)) reset.mutate(password)
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="You'll be signed out on any other devices."
      footer={footer}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        <Button
          type="submit"
          variant="primary"
          block
          className={styles.submit}
          loading={reset.isPending}
          loadingText="Saving…"
        >
          Save new password
        </Button>
      </form>
    </AuthLayout>
  )
}
