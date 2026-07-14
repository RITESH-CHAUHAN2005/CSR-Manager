import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import {
  getCarryForwardReport,
  getCompanyPositions,
  getDashboard,
  getYearWiseReport,
} from '../controllers/analyticsController.js'
import { exportExcel, exportPdf } from '../controllers/exportController.js'

const router = Router()
router.use(authenticate)

// Main Dashboard overview — visible to every signed-in role.
router.get('/dashboard/summary', getDashboard)

// Reports data — visible to every role (admin, editor, viewer).
router.get('/reports/year-wise', getYearWiseReport)
router.get('/reports/company-positions', getCompanyPositions)
router.get('/reports/carry-forward', getCarryForwardReport)

// Exports — every signed-in role, same visibility as the report data itself.
router.get('/reports/export/excel', exportExcel)
router.get('/reports/export/pdf', exportPdf)

export default router
