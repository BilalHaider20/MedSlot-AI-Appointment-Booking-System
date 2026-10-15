import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router'
import { authApi } from '../api/auth'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { AuthLayout } from './AuthLayout'
import { hasErrors, mapServerError, validateEmail, type Errors } from './authValidation'
import styles from './AuthLayout.module.css'

type Field = 'email' | 'password'
const FIELDS: readonly Field[] = ['email', 'password']

function validate(email: string, password: string): Errors<Field> {
  return {
    email: validateEmail(email),
    password: password ? undefined : 'Enter your password.',
  }
}

export function LoginPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const login = useMutation({
    mutationFn: authApi.login,
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

  function revalidate(nextEmail: string, nextPassword: string) {
    if (submitted) setErrors(validate(nextEmail, nextPassword))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setFormError(null)
    const nextErrors = validate(email, password)
    setErrors(nextErrors)
    if (!hasErrors(nextErrors)) login.mutate({ email: email.trim(), password })
  }

  return (
    <AuthLayout
      title="Log in"
      subtitle="Book and manage your appointments."
      footer={
        <>
          New here? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {notice && !formError && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
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
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value)
            revalidate(event.target.value, password)
          }}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value)
            revalidate(email, event.target.value)
          }}
        />
        <Link to="/forgot-password" className={styles.inlineLink}>
          Forgot password?
        </Link>
        <Button
          type="submit"
          variant="primary"
          block
          className={styles.submit}
          loading={login.isPending}
          loadingText="Logging in…"
        >
          Log in
        </Button>
      </form>
    </AuthLayout>
  )
}
