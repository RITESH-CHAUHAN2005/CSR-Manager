import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { validateBody } from '../middleware/validate.js'
import { createUserSchema } from '../validators/schemas.js'
import { createUser, deleteUser, listUsers } from '../controllers/userController.js'

// All user-management endpoints are admin-only.
const router = Router()
router.use(authenticate, requireAdmin)

router.get('/', listUsers)
router.post('/', validateBody(createUserSchema), createUser)

router.delete('/:id', deleteUser)

export default router
