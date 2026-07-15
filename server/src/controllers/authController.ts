import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/User.js'
import { AuditLog } from '../models/AuditLog.js'
import { SupportRequest } from '../models/SupportRequest.js'
import { clearAuthCookie, setAuthCookie, signToken } from '../utils/token.js'

// A real bcrypt hash compared against when the email doesn't exist, so the response
// time is the same as a wrong-password attempt — prevents email enumeration via timing.
const DUMMY_HASH = '$2a$12$w.QHer3KyFbA04iUJMEUiOGi6Dc/kOpvH0zpybMjYZMg6BwCdPPBK'

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash')

  // Generic error message — never reveal whether the email exists.
  const invalid = () => new ApiError(401, 'Invalid email or password')

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
  if (!ok) {
    await User.recordFailedLogin(user._id as never)
    await recordFail(String(user._id))
    throw invalid()
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

  // Return the token in the body too. Same-origin clients use the httpOnly
  // cookie; split-domain clients (frontend and API on different hosts, where
  // third-party cookies may be blocked) send it back as a Bearer header.
  res.json({ user: user.toJSON(), token })
})

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

// PUBLIC. A user asks for a password reset. We ALWAYS return the same generic
// { ok: true } regardless of whether the email exists — never reveal account
// existence (anti-enumeration). When the email does belong to a user and no
// pending request already exists, we queue one for an admin to review.
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string }
  const normalized = email.toLowerCase()

  const user = await User.findOne({ email: normalized })
  if (user) {
    const existing = await SupportRequest.findOne({
      userId: user._id,
      type: 'password',
      status: 'pending',
    })
    if (!existing) {
      await SupportRequest.create({
        userId: user._id,
        name: user.name,
        email: user.email,
        type: 'password',
        subject: 'Password reset',
        message: '',
        status: 'pending',
      })
      AuditLog.create({
        userId: user._id,
        userEmail: user.email,
        action: 'password_reset_requested',
        entity: 'auth',
        method: 'POST',
        path: '/api/auth/forgot-password',
        ip: req.ip,
        statusCode: 200,
      }).catch(() => {})
    }
  }

  // Identical response in every case (found / not found / duplicate).
  res.json({ ok: true })
})

// AUTHENTICATED. The signed-in user changes their own password. Requires the
// current password to be re-verified, and clears the mustChangePassword flag so
// a forced-reset user is released once they've set a new password.
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string
    newPassword: string
  }

  const user = await User.findById(req.user!.id).select('+passwordHash')
  if (!user) throw new ApiError(401, 'Session is no longer valid')

  const ok = await user.comparePassword(currentPassword)
  if (!ok) throw new ApiError(400, 'Current password is incorrect')

  user.passwordHash = await bcrypt.hash(newPassword, 12)
  user.mustChangePassword = false
  await user.save()

  AuditLog.create({
    userId: user._id,
    userEmail: user.email,
    userRole: user.role,
    action: 'password_changed',
    entity: 'user',
    entityId: String(user._id),
    method: 'POST',
    path: '/api/auth/change-password',
    ip: req.ip,
    statusCode: 200,
  }).catch(() => {})

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
