import { Router } from 'express'
import authRoutes from './authRoutes.js'
import analyticsRoutes from './analyticsRoutes.js'
import userRoutes from './userRoutes.js'
import logRoutes from './logRoutes.js'
import { entityRouter } from './entityRouter.js'
import { blockActiveProjectDelete } from '../middleware/guardProjectDelete.js'
import { computeProjectDates } from '../middleware/computeProjectDates.js'
import { normalizeProjectCommitments } from '../middleware/normalizeProjectCommitments.js'
import { requireActiveFinancialYear } from '../middleware/requireActiveFinancialYear.js'
import fundReceiptRoutes from './fundReceiptRoutes.js'
import projectDocumentRoutes from './projectDocumentRoutes.js'
import expenditureDocumentRoutes from './expenditureDocumentRoutes.js'
import { Company } from '../models/Company.js'
import { FinancialYear } from '../models/FinancialYear.js'
import { Project } from '../models/Project.js'
import { FundReceipt } from '../models/FundReceipt.js'
import { Expenditure } from '../models/Expenditure.js'
import { MasterDataItem } from '../models/MasterDataItem.js'
import {
  companySchema,
  expenditureSchema,
  financialYearSchema,
  fundReceiptSchema,
  masterDataItemSchema,
  projectSchema,
} from '../validators/schemas.js'

const api = Router()

api.get('/health', (_req, res) => res.json({ status: 'ok' }))

api.use('/auth', authRoutes)
api.use('/users', userRoutes)
api.use('/logs', logRoutes)

// All data resources: read = any role; create/update/delete = admin + editor.
api.use('/companies', entityRouter(Company, companySchema, 'company'))
api.use(
  '/financial-years',
  entityRouter(FinancialYear, financialYearSchema, 'financialYear', {
    listSort: { startDate: 1 },
  }),
)
// Active projects are protected from deletion (mark completed first) — see guard.
api.use(
  '/projects',
  entityRouter(Project, projectSchema, 'project', {
    deleteGuards: [blockActiveProjectDelete],
    preValidate: [normalizeProjectCommitments, computeProjectDates],
  }),
)
// /bulk must be mounted before the generic CRUD router.
api.use('/fund-receipts', fundReceiptRoutes)
api.use(
  '/fund-receipts',
  entityRouter(FundReceipt, fundReceiptSchema, 'fundReceipt', {
    preValidateCreate: [requireActiveFinancialYear],
  }),
)
api.use(
  '/expenditures',
  entityRouter(Expenditure, expenditureSchema, 'expenditure', {
    preValidateCreate: [requireActiveFinancialYear],
  }),
)
api.use('/master-data', entityRouter(MasterDataItem, masterDataItemSchema, 'masterData'))
api.use('/projects/:projectId/documents', projectDocumentRoutes)
api.use('/expenditures/:expenditureId/documents', expenditureDocumentRoutes)

api.use('/', analyticsRoutes)

export default api
