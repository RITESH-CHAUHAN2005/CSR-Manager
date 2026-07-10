import { Router } from 'express'
import { createFundReceiptsBulk } from '../controllers/fundReceiptController.js'
import { authenticate } from '../middleware/auth.js'
import { requireWrite } from '../middleware/authorize.js'
import { validateBody } from '../middleware/validate.js'
import { auditLog } from '../middleware/audit.js'
import { fundReceiptBulkSchema } from '../validators/schemas.js'

// Mounted ahead of the generic fund-receipts entityRouter so POST /fund-receipts/bulk
// resolves here. Everything else about fund receipts stays on the standard CRUD routes.
const router = Router()

router.post(
  '/bulk',
  authenticate,
  requireWrite,
  validateBody(fundReceiptBulkSchema),
  auditLog('fundReceipt'),
  createFundReceiptsBulk,
)

export default router
