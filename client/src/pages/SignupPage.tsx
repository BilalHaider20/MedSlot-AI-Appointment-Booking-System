import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { authApi, type SignupInput } from '../api/auth'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { AuthLayout } from './AuthLayout'
import {
  MIN_PASSWORD,
  hasErrors,
  mapServerError,
  validateEmail,
  validateNewPassword,
  type Errors,
} from './authValidation'
import styles from './AuthLayout.module.css'

type Field = keyof SignupInput
const FIELDS: readonly Field[] = ['fullName', 'email', 'password']

function validate(values: SignupInput): Errors<Field> {
  return {
    fullName: values.fullName.trim() ? undefined : 'Enter your name.',
    email: validateEmail(values.email),
    password: validateNewPassword(values.password),
  }
}

export function SignupPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState<SignupInput>({ fullName: '', email: '', password: '' })
  const [errors, setErrors] = useState<Errors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const signup = useMutation({
    mutationFn: authApi.signup,
    onSuccess: (user) => {
      setUser(user)
      navigate('/', { replace: true })
    },
    onError: (error) => {
      const mapped = mapServerError(error, FIELDS)
      setErrors(mapped.errors)
      setFormError(mapped.formError)
    },
  })

  function update(field: Field, value: string) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (submitted) setErrors(validate(next))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setFormError(null)
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return
    signup.mutate({ fullName: values.fullName.trim(), email: values.email.trim(), password: values.password })
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="It takes a minute. You can book straight after."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <Input
          label="Full name"
          autoComplete="name"
          value={values.fullName}
          error={errors.fullName}
          onChange={(event) => update('fullName', event.target.value)}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(event) => update('email', event.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD} characters.`}
          value={values.password}
          error={errors.password}
          onChange={(event) => update('password', event.target.value)}
        />
        <Button
          type="submit"
          variant="primary"
          block
          className={styles.submit}
          loading={signup.isPending}
          loadingText="Creating account…"
        >
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
