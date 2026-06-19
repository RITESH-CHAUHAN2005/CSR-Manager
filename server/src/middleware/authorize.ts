import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/ApiError.js'
import type { Role } from '../models/User.js'

// Server-side RBAC. The authoritative check — frontend hiding is convenience only.
// Build a guard that admits only the listed roles.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action')
    }
    next()
  }
}

// Writes (create/update/delete on data) are allowed for admin + editor; viewer is read-only.
export const requireWrite = requireRole('admin', 'editor')

// The main analytics Dashboard is for admin + viewer; editors do not see it.
export const requireDashboard = requireRole('admin', 'viewer')
