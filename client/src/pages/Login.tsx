import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail } from '../components/icons'
import { homePathForRole, useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../lib/errors'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      navigate(homePathForRole(user.role), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  const inputWrap =
    'w-full rounded-xl border border-line bg-surface/60 py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-muted shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0F172A] px-4">
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-surface p-8 shadow-2xl animate-scale-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-line">
            <img src="/logo.png" alt="CSR Fund Manager" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">CSR Fund Manager</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your account</p>
        </div>

        <form onSubmit={onLogin} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={inputWrap}
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputWrap}
            />
          </div>

          {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-all hover:bg-primary-dark hover:shadow-md active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5 rounded-xl border border-line bg-ink/[0.03] p-3 text-xs text-muted">
          <p className="font-medium text-ink">Administrator login</p>
          <p>admin@csr.com / Admin@123</p>
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          Editor &amp; viewer accounts are created by the administrator from the Admin Panel.
        </p>
      </div>
    </div>
  )
}
