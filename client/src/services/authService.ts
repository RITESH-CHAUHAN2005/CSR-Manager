// Auth service with mock + API implementations, selected by VITE_USE_API.
//   - mock: validates against demoUsers, persists the user in localStorage.
//   - api:  real JWT login; the token lives in an httpOnly cookie (never in JS),
//           so session restore is done via GET /auth/me.
// The role is whatever the account has — there is no role selector at login.
import { api, setAuthToken, USE_API } from './api'
import type { User } from '../types'
import { demoUsers } from '../mocks/seedData'

const STORAGE_KEY = 'csr_auth_user'

interface AuthService {
  login(email: string, password: string): Promise<User>
  logout(): Promise<void>
  me(): Promise<User | null>
}

const mockAuth: AuthService = {
  async login(email, password) {
    const match = demoUsers.find(
      (u) => u.email === email.trim().toLowerCase() && u.password === password,
    )
    if (!match) throw new Error('Invalid email or password.')
    const user: User = { id: match.role, name: match.name, email: match.email, role: match.role }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    return user
  },
  async logout() {
    localStorage.removeItem(STORAGE_KEY)
  },
  async me() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  },
}

const apiAuth: AuthService = {
  async login(email, password) {
    const res = await api.post<{ user: User; token?: string }>('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    })
    // Persist the token for the Bearer-header fallback (split-domain deploys).
    if (res.data.token) setAuthToken(res.data.token)
    return res.data.user
  },
  async logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      setAuthToken(null)
    }
  },
  async me() {
    try {
      const res = await api.get<{ user: User }>('/auth/me')
      return res.data.user
    } catch {
      return null
    }
  },
}

export const authService: AuthService = USE_API ? apiAuth : mockAuth
