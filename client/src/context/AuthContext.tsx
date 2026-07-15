import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role, User } from '../types'
import { authService } from '../services/authService'

interface AuthState {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  role: Role | null
  isAdmin: boolean // full access incl. Admin Panel
  isViewer: boolean // read-only
  canWrite: boolean // admin + editor: create / update / delete
  canCreate: boolean // alias of canWrite (kept for existing page code)
  canSeeDashboard: boolean // admin + viewer (editors do not see the Dashboard)
  mustChangePassword: boolean // account is on a temporary password — force a change
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  // Re-fetch the signed-in user (e.g. after a self-service password change clears the
  // mustChangePassword flag) so the UI reflects the latest server state.
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore an existing session on first load (localStorage for mock, /auth/me for API).
  useEffect(() => {
    authService
      .me()
      .then(setUser)
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const u = await authService.login(email, password)
    setUser(u)
    return u
  }

  async function logout() {
    await authService.logout()
    setUser(null)
  }

  async function refresh() {
    const u = await authService.me()
    setUser(u)
  }

  const value = useMemo<AuthState>(() => {
    const role = user?.role ?? null
    const isAdmin = role === 'admin'
    const isViewer = role === 'viewer'
    const canWrite = role === 'admin' || role === 'editor'
    return {
      user,
      loading,
      isAuthenticated: !!user,
      role,
      isAdmin,
      isViewer,
      canWrite,
      canCreate: canWrite,
      canSeeDashboard: !!role, // every signed-in role can see the Dashboard
      mustChangePassword: !!user?.mustChangePassword,
      login,
      logout,
      refresh,
    }
  }, [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Where each role lands after login / when hitting an unauthorized route.
// Every role can see the Dashboard, so it is the common home.
export function homePathForRole(_role: Role | null): string {
  return '/dashboard'
}
