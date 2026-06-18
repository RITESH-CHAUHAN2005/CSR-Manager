import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Check, Lock, Mail, ShieldCheck, User as UserIcon } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../lib/errors'
import type { Role } from '../types'

type Mode = 'login' | 'register'

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [role, setRole] = useState<Role>('admin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password, role)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const msg = await register({ name, email, password })
      setSuccess(msg)
      setPassword('')
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  function prefill(r: Role) {
    setRole(r)
    setError('')
    if (r === 'admin') {
      setEmail('admin@csr.com')
      setPassword('Admin@123')
    } else {
      setEmail('user@csr.com')
      setPassword('User@123')
    }
  }

  function switchMode(m: Mode) {
    setMode(m)
    setError('')
    setSuccess('')
  }

  const roleBtn = (r: Role, label: string, Icon: typeof ShieldCheck) => (
    <button
      type="button"
      onClick={() => prefill(r)}
      className={[
        'flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors',
        role === r
          ? 'border-primary bg-primary text-white shadow-sm'
          : 'border-slate-300 bg-white text-slate-600 hover:border-primary/50',
      ].join(' ')}
    >
      <Icon size={16} />
      {label}
    </button>
  )

  const inputWrap = 'w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
            <Building2 size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">CSR Manager</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login' ? 'Sign in to your account' : 'Create an employee account'}
          </p>
        </div>

        {mode === 'login' ? (
          <>
            <div className="mb-5 flex gap-3">
              {roleBtn('admin', 'Admin', ShieldCheck)}
              {roleBtn('user', 'User', UserIcon)}
            </div>

            <form onSubmit={onLogin} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputWrap} />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputWrap} />
              </div>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

              <button type="submit" disabled={loading} className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark disabled:opacity-50">
                {loading ? 'Signing in…' : `Sign in as ${role === 'admin' ? 'Admin' : 'User'}`}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500">
              New employee?{' '}
              <button onClick={() => switchMode('register')} className="font-semibold text-primary hover:underline">
                Create an account
              </button>
            </p>

            <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <p className="font-medium text-slate-600">Demo credentials</p>
              <p>Admin — admin@csr.com / Admin@123 (full access)</p>
              <p>User — user@csr.com / User@123 (read-only)</p>
            </div>
          </>
        ) : (
          <>
            {success ? (
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Check size={22} weight="bold" />
                </div>
                <p className="text-sm text-green-700">{success}</p>
              </div>
            ) : (
              <form onSubmit={onRegister} className="space-y-4">
                <div className="relative">
                  <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputWrap} />
                </div>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputWrap} />
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 chars, 1 letter + 1 number" className={inputWrap} />
                </div>

                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

                <button type="submit" disabled={loading} className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark disabled:opacity-50">
                  {loading ? 'Submitting…' : 'Request account'}
                </button>
              </form>
            )}

            <p className="mt-5 text-center text-sm text-slate-500">
              Already have an account?{' '}
              <button onClick={() => switchMode('login')} className="font-semibold text-primary hover:underline">
                Sign in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
