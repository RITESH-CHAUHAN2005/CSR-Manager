// Auth service with mock + API implementations, selected by VITE_USE_API.
//   - mock: validates against demoUsers, persists the user in localStorage.
//   - api:  real JWT login; the token lives in an httpOnly cookie (never in JS),
//           so session restore is done via GET /auth/me.
import { api, setAuthToken, USE_API } from './api'
import type { Role, User } from '../types'
import { demoUsers } from '../mocks/seedData'

const STORAGE_KEY = 'csr_auth_user'

export interface RegisterInput {
  name: string
  email: string
  password: string
  companyId?: string
}

interface AuthService {
  login(email: string, password: string, role: Role): Promise<User>
  register(input: RegisterInput): Promise<string>
  logout(): Promise<void>
  me(): Promise<User | null>
}

const mockAuth: AuthService = {
  async login(email, password, role) {
    const match = demoUsers.find(
      (u) => u.email === email.trim().toLowerCase() && u.password === password && u.role === role,
    )
    if (!match) throw new Error('Invalid credentials for the selected role.')
    const user: User = { id: match.role, name: match.name, email: match.email, role: match.role }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    return user
  },
  async register() {
    return 'Registration received (demo mode). Use the live API for real approvals.'
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
  async login(email, password, role) {
    const res = await api.post<{ user: User; token?: string }>('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
      role,
    })
    // Persist the token for the Bearer-header fallback (split-domain deploys).
    if (res.data.token) setAuthToken(res.data.token)
    return res.data.user
  },
  async register(input) {
    const res = await api.post<{ message: string }>('/auth/register', input)
    return res.data.message
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
