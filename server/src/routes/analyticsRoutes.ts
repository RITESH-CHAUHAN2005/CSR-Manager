import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import {
  getCompanyPositions,
  getDashboard,
  getYearWiseReport,
} from '../controllers/analyticsController.js'
import { exportExcel, exportPdf } from '../controllers/exportController.js'

const router = Router()
router.use(authenticate)

router.get('/dashboard/summary', getDashboard)
router.get('/reports/year-wise', getYearWiseReport)
router.get('/reports/company-positions', getCompanyPositions)

// Exports — admin only (matches the spec: Admin can export).
router.get('/reports/export/excel', requireAdmin, exportExcel)
router.get('/reports/export/pdf', requireAdmin, exportPdf)

export default router
