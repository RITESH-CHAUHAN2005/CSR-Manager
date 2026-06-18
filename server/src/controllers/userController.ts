import type { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/User.js'
import { AuditLog } from '../models/AuditLog.js'

// All admin-only (gated at the route level).

export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await User.find().populate('companyId', 'name').sort({ createdAt: -1 })
  res.json(users)
})

async function setStatus(
  req: Request,
  res: Response,
  status: 'approved' | 'rejected',
  action: 'approve' | 'reject',
) {
  const user = await User.findById(req.params.id)
  if (!user) throw new ApiError(404, 'User not found')
  if (user.role === 'admin') throw new ApiError(400, 'Admin accounts cannot be modified here')

  user.status = status
  await user.save()

  AuditLog.create({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: 'admin',
    action,
    entity: 'user',
    entityId: String(user._id),
    label: `${user.name} (${user.email})`,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    statusCode: 200,
  }).catch(() => {})

  res.json(user.toJSON())
}

export const approveUser = asyncHandler((req, res) => setStatus(req, res, 'approved', 'approve'))
export const rejectUser = asyncHandler((req, res) => setStatus(req, res, 'rejected', 'reject'))

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new ApiError(404, 'User not found')
  if (user.role === 'admin') throw new ApiError(400, 'Admin accounts cannot be deleted here')
  await user.deleteOne()
  res.json({ id: req.params.id })
})
