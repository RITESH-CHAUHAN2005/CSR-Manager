import { Router } from 'express'
import authRoutes from './authRoutes.js'
import analyticsRoutes from './analyticsRoutes.js'
import userRoutes from './userRoutes.js'
import logRoutes from './logRoutes.js'
import { entityRouter } from './entityRouter.js'
import { blockActiveProjectDelete } from '../middleware/guardProjectDelete.js'
import { Company } from '../models/Company.js'
import { FinancialYear } from '../models/FinancialYear.js'
import { Project } from '../models/Project.js'
import { FundReceipt } from '../models/FundReceipt.js'
import { Expenditure } from '../models/Expenditure.js'
import {
  companySchema,
  expenditureSchema,
  financialYearSchema,
  fundReceiptSchema,
  projectSchema,
} from '../validators/schemas.js'

const api = Router()

api.get('/health', (_req, res) => res.json({ status: 'ok' }))

api.use('/auth', authRoutes)
api.use('/users', userRoutes)
api.use('/logs', logRoutes)

// All data resources: read = any role; create/update/delete = admin + editor.
api.use('/companies', entityRouter(Company, companySchema, 'company'))
api.use('/financial-years', entityRouter(FinancialYear, financialYearSchema, 'financialYear'))
// Active projects are protected from deletion (mark completed first) — see guard.
api.use(
  '/projects',
  entityRouter(Project, projectSchema, 'project', { deleteGuards: [blockActiveProjectDelete] }),
)
api.use('/fund-receipts', entityRouter(FundReceipt, fundReceiptSchema, 'fundReceipt'))
api.use('/expenditures', entityRouter(Expenditure, expenditureSchema, 'expenditure'))

api.use('/', analyticsRoutes)

export default api
