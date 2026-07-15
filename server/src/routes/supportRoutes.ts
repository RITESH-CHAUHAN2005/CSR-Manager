import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { validateBody } from '../middleware/validate.js'
import { createSupportRequestSchema, replySupportSchema } from '../validators/schemas.js'
import {
  createRequest,
  myRequests,
  listRequests,
  approveRequest,
  rejectRequest,
  replyRequest,
} from '../controllers/supportController.js'

const router = Router()
router.use(authenticate)

router.post('/', validateBody(createSupportRequestSchema), createRequest)
router.get('/mine', myRequests)
router.get('/', requireAdmin, listRequests)
router.post('/:id/approve', requireAdmin, approveRequest)
router.post('/:id/reject', requireAdmin, rejectRequest)
router.post('/:id/reply', requireAdmin, validateBody(replySupportSchema), replyRequest)

export default router
