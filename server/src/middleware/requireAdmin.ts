import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/ApiError.js'

// Server-side RBAC: only Admins may perform writes. Users are read-only.
// This is the authoritative check — the frontend hiding buttons is convenience only.
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin privileges required for this action')
  }
  next()
}
