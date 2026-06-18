import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import {
  approveUser,
  deleteUser,
  listUsers,
  rejectUser,
} from '../controllers/userController.js'

// All user-management endpoints are admin-only.
const router = Router()
router.use(authenticate, requireAdmin)

router.get('/', listUsers)
router.patch('/:id/approve', approveUser)
router.patch('/:id/reject', rejectUser)
router.delete('/:id', deleteUser)

export default router
