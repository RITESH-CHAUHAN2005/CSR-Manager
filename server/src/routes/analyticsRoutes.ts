import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireDashboard, requireWrite } from '../middleware/authorize.js'
import {
  getCompanyPositions,
  getDashboard,
  getYearWiseReport,
} from '../controllers/analyticsController.js'
import { exportExcel, exportPdf } from '../controllers/exportController.js'

const router = Router()
router.use(authenticate)

// Main Dashboard overview — admin + viewer only (editors do not see the Dashboard).
router.get('/dashboard/summary', requireDashboard, getDashboard)

// Reports data — visible to every role (admin, editor, viewer).
router.get('/reports/year-wise', getYearWiseReport)
router.get('/reports/company-positions', getCompanyPositions)

// Exports — admin + editor (viewer is read-only and cannot export).
router.get('/reports/export/excel', requireWrite, exportExcel)
router.get('/reports/export/pdf', requireWrite, exportPdf)

export default router
