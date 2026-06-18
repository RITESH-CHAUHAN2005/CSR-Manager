import { Router } from 'express'
import type { Model } from 'mongoose'
import type { ZodSchema } from 'zod'
import { crudController } from '../controllers/crudController.js'
import { authenticate } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { validateBody } from '../middleware/validate.js'
import { auditLog } from '../middleware/audit.js'

interface Options {
  // When true, any authenticated (approved) user may CREATE — used for operational
  // records (projects, fund receipts, expenditures). Edit/Delete stay admin-only.
  allowUserCreate?: boolean
}

// Standard secured REST resource:
//   reads        -> any authenticated user
//   create       -> admin always; users too when allowUserCreate
//   update/delete-> admin only (users can never edit existing data or delete records)
// All writes are validated and audit-logged.
export function entityRouter<T>(
  model: Model<T>,
  schema: ZodSchema,
  entity: string,
  opts: Options = {},
) {
  const c = crudController(model)
  const router = Router()

  router.use(authenticate)
  router.get('/', c.list)
  router.get('/:id', c.get)

  const createGuards = opts.allowUserCreate ? [] : [requireAdmin]
  router.post('/', ...createGuards, validateBody(schema), auditLog(entity), c.create)
  router.put('/:id', requireAdmin, validateBody(schema), auditLog(entity), c.update)
  router.delete('/:id', requireAdmin, auditLog(entity), c.remove)

  return router
}
