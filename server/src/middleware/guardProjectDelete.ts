import type { NextFunction, Request, Response } from 'express'
import { Project } from '../models/Project.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

// Business rule: an ongoing (active) CSR project can never be deleted — by anyone,
// including admins. It must be marked 'completed' first, then it can be removed.
// This protects live projects (with fund flow / expenditures against them) from
// accidental or unauthorized deletion. Enforced server-side so it holds for the
// website AND the mobile app, which share this same backend.
export const blockActiveProjectDelete = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const project = await Project.findById(req.params.id)
    if (!project) throw new ApiError(404, 'Not found')
    if (project.status === 'active') {
      throw new ApiError(
        409,
        'This project is Active and cannot be deleted. Mark it as Completed first, then delete it.',
      )
    }
    next()
  },
)
