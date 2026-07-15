import { useState } from 'react'
import { authService } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../lib/errors'
import { Field, Modal, PrimaryButton, TextInput } from './ui'

// Client-side mirror of the backend password policy (min 8, ≥1 letter, ≥1 number).
function policyError(pw: string): string | null {
  if (pw.length < 8) return 'New password must be at least 8 characters.'
  if (!/[A-Za-z]/.test(pw)) return 'New password must contain a letter.'
  if (!/\d/.test(pw)) return 'New password must contain a number.'
  return null
}

// The core form: current password, new password, confirm. On success it re-syncs the
// signed-in user (clearing mustChangePassword) and calls onDone.
// `inline` lays the three fields + button out in a single row (used in the Admin Panel,
// to match the Add-User form); the default is a stacked column (modal / forced screen).
export function ChangePasswordForm({ onDone, inline = false }: { onDone?: () => void; inline?: boolean }) {
  const { refresh } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setOk('')
    const policy = policyError(next)
    if (policy) return setError(policy)
    if (next !== confirm) return setError('New password and confirmation do not match.')
    if (next === current) return setError('New password must be different from the current one.')
    setBusy(true)
    try {
      await authService.changePassword(current, next)
      await refresh()
      setOk('Password changed successfully.')
      setCurrent('')
      setNext('')
      setConfirm('')
      onDone?.()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not change password'))
    } finally {
      setBusy(false)
    }
  }

  const currentField = (
    <Field label="Current Password">
      <TextInput
        type="password"
        required
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        placeholder="Current password"
      />
    </Field>
  )
  const newField = (
    <Field label="New Password">
      <TextInput
        type="password"
        required
        value={next}
        onChange={(e) => setNext(e.target.value)}
        placeholder="Min 8 chars, 1 letter + 1 number"
      />
    </Field>
  )
  const confirmField = (
    <Field label="Confirm New Password">
      <TextInput
        type="password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Re-enter new password"
      />
    </Field>
  )
  const messages = (
    <>
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {ok && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{ok}</p>}
    </>
  )

  if (inline) {
    return (
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {currentField}
          {newField}
          {confirmField}
          <div className="flex items-end">
            <PrimaryButton type="submit" icon={false} disabled={busy}>
              {busy ? 'Saving…' : 'Change Password'}
            </PrimaryButton>
          </div>
        </div>
        {messages}
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {currentField}
      {newField}
      {confirmField}
      {messages}
      <div className="flex justify-end pt-1">
        <PrimaryButton type="submit" icon={false} disabled={busy}>
          {busy ? 'Saving…' : 'Change Password'}
        </PrimaryButton>
      </div>
    </form>
  )
}

// Sidebar-triggered modal wrapper.
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Change Password">
      <ChangePasswordForm onDone={() => setTimeout(onClose, 800)} />
    </Modal>
  )
}

// Full-screen blocker shown when the account is on a temporary password (an admin just
// approved a reset). The user cannot reach the app until they set their own password.
export function ForcePasswordChangeScreen() {
  const { logout, user } = useAuth()
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0F172A] px-4">
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="glass-card relative w-full max-w-md rounded-2xl p-8 animate-scale-in">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Set a New Password</h1>
          <p className="mt-1 text-sm text-muted">
            You're signed in with a temporary password{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.
            Choose your own password to continue.
          </p>
        </div>
        <ChangePasswordForm />
        <button
          onClick={logout}
          className="mt-4 w-full text-center text-sm font-medium text-muted hover:text-ink"
        >
          Sign out instead
        </button>
      </div>
    </div>
  )
}
