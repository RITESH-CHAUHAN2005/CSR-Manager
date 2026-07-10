import type { Model } from 'mongoose'
import type { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { snapshot, diff } from '../utils/auditSnapshot.js'

// Best-effort human label for a record (for activity logs).
function labelOf(doc: Record<string, unknown>): string {
  return String(doc.name ?? doc.reference ?? doc.category ?? doc.id ?? '')
}

// Factory producing standard REST handlers for a Mongoose model.
// Writes are gated at the route level (requireAdmin or allowUserCreate); these stay generic.
// `listSort` overrides the default creation-order sort — e.g. Financial Years
// list chronologically by startDate, not by when each record was added.
export function crudController<T>(model: Model<T>, listSort: Record<string, 1 | -1> = { createdAt: 1 }) {
  return {
    list: asyncHandler(async (_req: Request, res: Response) => {
      const docs = await model.find().sort(listSort)
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
      const json = doc.toJSON() as Record<string, unknown>
      res.locals.auditLabel = labelOf(json)
      res.locals.auditAfter = await snapshot(json) // what was created
      res.status(201).json(doc)
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
      // Capture the pre-image so the activity log can show before → after.
      const existing = await model.findById(req.params.id)
      if (!existing) throw new ApiError(404, 'Not found')
      const beforeSnap = await snapshot(existing.toJSON() as Record<string, unknown>)

      const doc = await model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      })
      if (!doc) throw new ApiError(404, 'Not found')
      const json = doc.toJSON() as Record<string, unknown>
      const afterSnap = await snapshot(json)

      res.locals.auditLabel = labelOf(json)
      res.locals.auditBefore = beforeSnap
      res.locals.auditAfter = afterSnap
      res.locals.auditChanges = diff(beforeSnap, afterSnap) // only fields that changed
      res.json(doc)
    }),

    remove: asyncHandler(async (req: Request, res: Response) => {
      const doc = await model.findByIdAndDelete(req.params.id)
      if (!doc) throw new ApiError(404, 'Not found')
      const json = doc.toJSON() as Record<string, unknown>
      res.locals.auditLabel = labelOf(json)
      res.locals.auditBefore = await snapshot(json) // what was removed
      res.json({ id: req.params.id })
    }),
  }
}
