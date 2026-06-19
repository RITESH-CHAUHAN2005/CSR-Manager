import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/User.js'
import { AuditLog } from '../models/AuditLog.js'

// All admin-only (gated at the route level).

export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await User.find().populate('companyId', 'name').sort({ createdAt: -1 })
  res.json(users)
})

// Admin creates an editor or viewer account (no self-registration). Admin accounts
// can never be created via the API — role is restricted to editor/viewer by the schema.
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role, companyId } = req.body as {
    name: string
    email: string
    password: string
    role: 'editor' | 'viewer'
    companyId?: string
  }

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) throw new ApiError(409, 'A user with this email already exists')

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role,
    companyId: companyId || undefined,
  })

  AuditLog.create({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: 'admin',
    action: 'create',
    entity: 'user',
    entityId: String(user._id),
    label: `${user.name} (${user.email}) · ${role}`,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    statusCode: 201,
  }).catch(() => {})

  res.status(201).json(user.toJSON())
})

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new ApiError(404, 'User not found')
  if (user.role === 'admin') throw new ApiError(400, 'Admin accounts cannot be deleted here')
  await user.deleteOne()

  AuditLog.create({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: 'admin',
    action: 'delete',
    entity: 'user',
    entityId: String(user._id),
    label: `${user.name} (${user.email})`,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    statusCode: 200,
  }).catch(() => {})

  res.json({ id: req.params.id })
})
