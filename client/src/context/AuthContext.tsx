import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role, User } from '../types'
import { authService, type RegisterInput } from '../services/authService'

interface AuthState {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  canWrite: boolean // admin: full CRUD
  canCreate: boolean // admin or approved user: may create records
  login: (email: string, password: string, role: Role) => Promise<void>
  register: (input: RegisterInput) => Promise<string>
  logout: () => void
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

  async function login(email: string, password: string, role: Role) {
    const u = await authService.login(email, password, role)
    setUser(u)
  }

  function register(input: RegisterInput) {
    return authService.register(input)
  }

  async function logout() {
    await authService.logout()
    setUser(null)
  }

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      canWrite: user?.role === 'admin',
      canCreate: !!user, // any authenticated user may create operational records
      login,
      register,
      logout,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
