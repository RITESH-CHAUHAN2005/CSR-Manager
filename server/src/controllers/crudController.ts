import type { Model } from 'mongoose'
import type { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'

// Best-effort human label for a record (for activity logs).
function labelOf(doc: Record<string, unknown>): string {
  return String(doc.name ?? doc.reference ?? doc.category ?? doc.id ?? '')
}

// Factory producing standard REST handlers for a Mongoose model.
// Writes are gated at the route level (requireAdmin or allowUserCreate); these stay generic.
export function crudController<T>(model: Model<T>) {
  return {
    list: asyncHandler(async (_req: Request, res: Response) => {
      const docs = await model.find().sort({ createdAt: 1 })
      res.json(docs)
    }),

    get: asyncHandler(async (req: Request, res: Response) => {
      const doc = await model.findById(req.params.id)
      if (!doc) throw new ApiError(404, 'Not found')
      res.json(doc)
    }),

    create: asyncHandler(async (req: Request, res: Response) => {
      // Stamp the creator (denormalized) so activity dashboards can attribute records.
      const payload = {
        ...req.body,
        createdById: req.user?.id,
        createdByEmail: req.user?.email,
        createdByName: req.user?.name,
      }
      const doc = await model.create(payload)
      res.locals.auditLabel = labelOf(doc.toJSON() as Record<string, unknown>)
      res.status(201).json(doc)
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
      const doc = await model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      })
      if (!doc) throw new ApiError(404, 'Not found')
      res.locals.auditLabel = labelOf(doc.toJSON() as Record<string, unknown>)
      res.json(doc)
    }),

    remove: asyncHandler(async (req: Request, res: Response) => {
      const doc = await model.findByIdAndDelete(req.params.id)
      if (!doc) throw new ApiError(404, 'Not found')
      res.locals.auditLabel = labelOf(doc.toJSON() as Record<string, unknown>)
      res.json({ id: req.params.id })
    }),
  }
}
