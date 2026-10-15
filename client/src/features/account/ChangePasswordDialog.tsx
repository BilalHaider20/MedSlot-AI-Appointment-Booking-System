import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../api/auth'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Input } from '../../components/Input'
import { useToast } from '../../components/Toast'
import { hasErrors, mapServerError, validateNewPassword, type Errors } from '../../pages/authValidation'
import styles from './ChangePasswordDialog.module.css'

type Field = 'currentPassword' | 'newPassword' | 'confirm'

function validate(current: string, next: string, confirm: string): Errors<Field> {
  return {
    currentPassword: current ? undefined : 'Enter your current password.',
    newPassword: validateNewPassword(next),
    confirm: confirm === next ? undefined : "The passwords don't match.",
  }
}

interface ChangePasswordDialogProps {
  open: boolean
  onClose: () => void
}

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  return (
    <Dialog open={open} title="Change password" onClose={onClose}>
      <ChangePasswordForm onDone={onClose} />
    </Dialog>
  )
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const change = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      toast('Password changed. Any other devices have been signed out.')
      onDone()
    },
    onError: (error) => {
      const mapped = mapServerError(error, ['currentPassword', 'newPassword'] as const)
      setErrors(mapped.errors)
      setFormError(mapped.formError)
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validate(current, next, confirm)
    setErrors(nextErrors)
    if (!hasErrors(nextErrors)) change.mutate({ currentPassword: current, newPassword: next })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}
      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={current}
        error={errors.currentPassword}
        onChange={(event) => setCurrent(event.target.value)}
      />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters. You'll stay signed in here."
        value={next}
        error={errors.newPassword}
        onChange={(event) => setNext(event.target.value)}
      />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        error={errors.confirm}
        onChange={(event) => setConfirm(event.target.value)}
      />
      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={change.isPending} loadingText="Saving…">
          Change password
        </Button>
      </div>
    </form>
  )
}
