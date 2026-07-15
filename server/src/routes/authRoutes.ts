import { Router } from 'express'
import { changePassword, forgotPassword, login, logout, me } from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { changePasswordSchema, forgotPasswordSchema, loginSchema } from '../validators/schemas.js'
import { authLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.post('/login', authLimiter, validateBody(loginSchema), login)
router.post('/logout', logout)
router.get('/me', authenticate, me)
router.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), forgotPassword)
router.post('/change-password', authenticate, validateBody(changePasswordSchema), changePassword)

export default router
