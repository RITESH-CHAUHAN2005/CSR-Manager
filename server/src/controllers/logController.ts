import type { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { AuditLog } from '../models/AuditLog.js'

// Admin: full activity log (who / when / what), newest first, with optional filters.
export const listLogs = asyncHandler(async (req: Request, res: Response) => {
  const { userEmail, action, entity } = req.query as Record<string, string>
  const limit = Math.min(Number(req.query.limit) || 300, 1000)

  const filter: Record<string, unknown> = {}
  if (userEmail) filter.userEmail = userEmail
  if (action) filter.action = action
  if (entity) filter.entity = entity

  const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit)
  res.json(logs)
})

// Any authenticated user: their own activity (for the user dashboard).
export const myLogs = asyncHandler(async (req: Request, res: Response) => {
  const logs = await AuditLog.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(300)
  res.json(logs)
})

// Admin: wipe the entire activity log.
export const clearLogs = asyncHandler(async (_req: Request, res: Response) => {
  const { deletedCount } = await AuditLog.deleteMany({})
  res.json({ deleted: deletedCount ?? 0 })
})
