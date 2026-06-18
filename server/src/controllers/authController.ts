import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/User.js'
import { AuditLog } from '../models/AuditLog.js'
import { clearAuthCookie, setAuthCookie, signToken } from '../utils/token.js'

// A real bcrypt hash compared against when the email doesn't exist, so the response
// time is the same as a wrong-password attempt — prevents email enumeration via timing.
const DUMMY_HASH = '$2a$12$w.QHer3KyFbA04iUJMEUiOGi6Dc/kOpvH0zpybMjYZMg6BwCdPPBK'

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, role } = req.body as { email: string; password: string; role: string }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash')

  // Generic error message — never reveal whether the email exists.
  const invalid = () => new ApiError(401, 'Invalid credentials for the selected role')

  const recordFail = (id?: string) =>
    AuditLog.create({
      userId: id,
      userEmail: email.toLowerCase(),
      action: 'login_failed',
      entity: 'auth',
      method: 'POST',
      path: '/api/auth/login',
      ip: req.ip,
      statusCode: 401,
    }).catch(() => {})

  if (!user) {
    // Equalize timing with the real-password path before responding.
    await bcrypt.compare(password, DUMMY_HASH)
    await recordFail()
    throw invalid()
  }

  if (user.isLocked()) {
    throw new ApiError(429, 'Account temporarily locked due to failed attempts. Try again later.')
  }

  const ok = await user.comparePassword(password)
  if (!ok || user.role !== role) {
    await User.recordFailedLogin(user._id as never)
    await recordFail(String(user._id))
    throw invalid()
  }

  // Self-registered employees must be approved by an admin before they can sign in.
  if (user.status !== 'approved') {
    await recordFail(String(user._id))
    throw new ApiError(
      403,
      user.status === 'pending'
        ? 'Your account is awaiting admin approval.'
        : 'Your account request was rejected. Please contact the administrator.',
    )
  }

  await User.resetLoginAttempts(user._id as never)

  const token = signToken({
    sub: String(user._id),
    role: user.role,
    email: user.email,
    name: user.name,
  })
  setAuthCookie(res, token)

  AuditLog.create({
    userId: user._id,
    userEmail: user.email,
    action: 'login',
    entity: 'auth',
    method: 'POST',
    path: '/api/auth/login',
    ip: req.ip,
    statusCode: 200,
  }).catch(() => {})

  res.json({ user: user.toJSON() })
})

// Employee self-registration: creates a pending 'user' account. Admin must approve
// before login is allowed. bcrypt cost 12. Never returns whether the email pre-existed.
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, companyId } = req.body as {
    name: string
    email: string
    password: string
    companyId?: string
  }

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) {
    // Generic success-style message — don't reveal that the email is registered.
    return res.status(202).json({
      message: 'Registration received. If approved by an admin, you will be able to sign in.',
    })
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role: 'user',
    status: 'pending',
    companyId: companyId || undefined,
  })

  AuditLog.create({
    userId: user._id,
    userEmail: user.email,
    userRole: 'user',
    action: 'register',
    entity: 'user',
    entityId: String(user._id),
    label: user.name,
    method: 'POST',
    path: '/api/auth/register',
    ip: req.ip,
    statusCode: 202,
  }).catch(() => {})

  res.status(202).json({
    message: 'Registration received. An admin will review and approve your account.',
  })
})

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id)
  // A valid token whose user no longer exists (e.g. after a re-seed/deletion) is a
  // dead session, not a missing resource. Clear the stale cookie and return 401 so
  // the client treats it as "logged out" and shows the login page — not an error.
  if (!user) {
    clearAuthCookie(res)
    throw new ApiError(401, 'Session is no longer valid')
  }
  res.json({ user: user.toJSON() })
})
