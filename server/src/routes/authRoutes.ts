import { Router } from 'express'
import { login, logout, me, register } from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { loginSchema, registerSchema } from '../validators/schemas.js'
import { authLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.post('/login', authLimiter, validateBody(loginSchema), login)
router.post('/register', authLimiter, validateBody(registerSchema), register)
router.post('/logout', logout)
router.get('/me', authenticate, me)

export default router
