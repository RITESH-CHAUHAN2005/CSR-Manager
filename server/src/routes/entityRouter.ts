import { Router, type RequestHandler } from 'express'
import type { Model } from 'mongoose'
import type { ZodSchema } from 'zod'
import { crudController } from '../controllers/crudController.js'
import { authenticate } from '../middleware/auth.js'
import { requireWrite } from '../middleware/authorize.js'
import { validateBody } from '../middleware/validate.js'
import { auditLog } from '../middleware/audit.js'

// Optional per-resource business-rule guards, run after the write-permission check
// but before the mutation (e.g. "active projects can't be deleted").
interface EntityRouterOptions {
  deleteGuards?: RequestHandler[]
  // Runs after the write-permission check but before body validation — for
  // resources that need to compute/normalize fields the client doesn't send.
  // Applies to both create (POST) and update (PUT).
  preValidate?: RequestHandler[]
  // Same as preValidate, but only runs on create (POST) — for rules that must
  // hold for new records without locking down edits to existing ones.
  preValidateCreate?: RequestHandler[]
  // Overrides the default "sort by creation order" for GET / — e.g. Financial
  // Years should list chronologically by startDate, not by insertion order.
  listSort?: Record<string, 1 | -1>
}

// Standard secured REST resource:
//   reads         -> any authenticated user (admin / editor / viewer)
//   create/update/delete -> admin + editor only (viewer is strictly read-only)
// All writes are validated and audit-logged.
export function entityRouter<T>(
  model: Model<T>,
  schema: ZodSchema,
  entity: string,
  opts: EntityRouterOptions = {},
) {
  const c = crudController(model, opts.listSort)
  const router = Router()

  router.use(authenticate)
  router.get('/', c.list)
  router.get('/:id', c.get)

  const preValidate = opts.preValidate ?? []
  const preValidateCreate = opts.preValidateCreate ?? []
  router.post(
    '/',
    requireWrite,
    ...preValidate,
    ...preValidateCreate,
    validateBody(schema),
    auditLog(entity),
    c.create,
  )
  router.put('/:id', requireWrite, ...preValidate, validateBody(schema), auditLog(entity), c.update)
  router.delete('/:id', requireWrite, ...(opts.deleteGuards ?? []), auditLog(entity), c.remove)

  return router
}
