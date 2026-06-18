import { Router } from 'express'
import authRoutes from './authRoutes.js'
import analyticsRoutes from './analyticsRoutes.js'
import userRoutes from './userRoutes.js'
import logRoutes from './logRoutes.js'
import { entityRouter } from './entityRouter.js'
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

// Master data — admin-only writes.
api.use('/companies', entityRouter(Company, companySchema, 'company'))
api.use('/financial-years', entityRouter(FinancialYear, financialYearSchema, 'financialYear'))

// Operational records — approved users may also create (edit/delete still admin-only).
api.use('/projects', entityRouter(Project, projectSchema, 'project', { allowUserCreate: true }))
api.use('/fund-receipts', entityRouter(FundReceipt, fundReceiptSchema, 'fundReceipt', { allowUserCreate: true }))
api.use('/expenditures', entityRouter(Expenditure, expenditureSchema, 'expenditure', { allowUserCreate: true }))

api.use('/', analyticsRoutes)

export default api
