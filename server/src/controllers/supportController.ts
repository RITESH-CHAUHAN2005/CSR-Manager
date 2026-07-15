import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/User.js'
import { AuditLog } from '../models/AuditLog.js'
import { SupportRequest } from '../models/SupportRequest.js'

// AUTHENTICATED. The signed-in user files a free-form help-desk request. Their
// identity is taken from the token, never the body.
export const createRequest = asyncHandler(async (req: Request, res: Response) => {
  const { subject, message } = req.body as { subject: string; message: string }

  const doc = await SupportRequest.create({
    userId: req.user!.id,
    name: req.user!.name,
    email: req.user!.email,
    type: 'general',
    subject,
    message,
    status: 'pending',
  })

  AuditLog.create({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'support_request_created',
    entity: 'support',
    entityId: String(doc._id),
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    statusCode: 201,
  }).catch(() => {})

  res.status(201).json(doc.toJSON())
})

// AUTHENTICATED. The signed-in user's own request history.
export const myRequests = asyncHandler(async (req: Request, res: Response) => {
  res.json(await SupportRequest.find({ userId: req.user!.id }).sort({ createdAt: -1 }))
})

// ADMIN. The pending queue an admin reviews (both password and general requests).
export const listRequests = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await SupportRequest.find({ status: 'pending' }).sort({ createdAt: -1 }))
})

// ADMIN. Approve a password-reset request: the user is set to a deterministic
// temporary password ("<firstname>@apl123"), forced to change it on next login, and
// any lock cleared. The temp password is returned so the admin can relay it.
export const approveRequest = asyncHandler(async (req: Request, res: Response) => {
  const request = await SupportRequest.findById(req.params.id)
  if (!request || request.status !== 'pending') throw new ApiError(404, 'Request not found')
  if (request.type !== 'password') throw new ApiError(400, 'This request is not a password reset')

  const user = await User.findById(request.userId)
  if (!user) throw new ApiError(404, 'User not found')

  const firstName = user.name.trim().split(/\s+/)[0].toLowerCase()
  const tempPassword = `${firstName}@apl123`

  user.passwordHash = await bcrypt.hash(tempPassword, 12)
  user.mustChangePassword = true
  user.loginAttempts = 0
  user.lockUntil = undefined
  await user.save()

  request.status = 'approved'
  request.resolvedByEmail = req.user!.email
  await request.save()

  AuditLog.create({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: 'admin',
    action: 'password_reset_approved',
    entity: 'support',
    entityId: String(user._id),
    label: user.email,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    statusCode: 200,
  }).catch(() => {})

  res.json({ id: request.id ?? String(request._id), tempPassword })
})

// ADMIN. Reject a pending request; nothing changes on the user account.
export const rejectRequest = asyncHandler(async (req: Request, res: Response) => {
  const request = await SupportRequest.findById(req.params.id)
  if (!request || request.status !== 'pending') throw new ApiError(404, 'Request not found')

  request.status = 'rejected'
  request.resolvedByEmail = req.user!.email
  await request.save()

  AuditLog.create({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: 'admin',
    action: 'support_request_rejected',
    entity: 'support',
    entityId: String(request.userId),
    label: request.email,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    statusCode: 200,
  }).catch(() => {})

  res.json({ id: request.id ?? String(request._id) })
})

// ADMIN. Reply to a pending general request, marking it resolved.
export const replyRequest = asyncHandler(async (req: Request, res: Response) => {
  const { reply } = req.body as { reply: string }

  const request = await SupportRequest.findById(req.params.id)
  if (!request || request.status !== 'pending') throw new ApiError(404, 'Request not found')

  request.reply = reply
  request.status = 'resolved'
  request.resolvedByEmail = req.user!.email
  await request.save()

  AuditLog.create({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: 'admin',
    action: 'support_request_replied',
    entity: 'support',
    entityId: String(request.userId),
    label: request.email,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    statusCode: 200,
  }).catch(() => {})

  res.json({ id: request.id ?? String(request._id) })
})
