import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { listLogs, myLogs, clearLogs } from '../controllers/logController.js'

const router = Router()
router.use(authenticate)

router.get('/mine', myLogs) // any authenticated user — their own activity
router.get('/', requireAdmin, listLogs) // admin — full activity log
router.delete('/', requireAdmin, clearLogs) // admin — wipe the activity log

export default router
