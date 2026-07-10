import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeSlash, Info, Lock, Mail } from '../components/icons'
import { homePathForRole, useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../lib/errors'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  const inputBase =
    'w-full rounded-xl border border-line bg-surface/60 py-2.5 pl-10 text-sm text-ink placeholder:text-muted shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0F172A] px-4">
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />

      <div className="glass-card relative w-full max-w-md rounded-2xl p-8 animate-scale-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo.png" alt="CSR Fund Manager" className="mb-3 h-16 w-16 object-contain" />
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
              className={`${inputBase} pr-3`}
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputBase} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
            >
              {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
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

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-xs text-muted">
          <Info size={15} className="mt-0.5 shrink-0 text-primary" />
          <p>
            Need an Editor or Viewer account? Ask your administrator — they can create one from the{' '}
            <span className="font-medium text-ink">Admin Panel</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
