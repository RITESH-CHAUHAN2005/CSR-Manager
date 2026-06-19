import { Router } from 'express'
import { login, logout, me } from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { loginSchema } from '../validators/schemas.js'
import { authLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.post('/login', authLimiter, validateBody(loginSchema), login)
router.post('/logout', logout)
router.get('/me', authenticate, me)

export default router
